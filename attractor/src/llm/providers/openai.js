import OpenAI from 'openai';

export class OpenAIProvider {
  #client;

  constructor(options = {}) {
    this.#client = new OpenAI({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
    });
    this.defaultModel = options.defaultModel ?? 'gpt-4o';
  }

  async complete(request) {
    const native = this.#toNative(request);
    let response;
    try {
      response = await this.#client.chat.completions.create(native);
    } catch (err) {
      throw this.#wrapError(err);
    }
    return this.#fromNative(response, request.model);
  }

  async *stream(request) {
    const native = { ...this.#toNative(request), stream: true };
    const stream = await this.#client.chat.completions.create(native);
    let fullText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        yield { type: 'text_delta', text: delta.content };
      }
    }

    yield { type: 'message_end', text: fullText };
  }

  // ── Conversion helpers ──────────────────────────────────────────────────

  #toNative(req) {
    const messages = [];

    for (const msg of req.messages ?? []) {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: this.#flattenContent(msg.content) });
        continue;
      }

      if (msg.role === 'tool_results') {
        // Each tool result becomes a separate message with role "tool"
        for (const r of msg.content) {
          messages.push({
            role:         'tool',
            tool_call_id: r.id,
            content:      r.content,
          });
        }
        continue;
      }

      if (msg.role === 'steering') {
        messages.push({ role: 'user', content: this.#flattenContent(msg.content) });
        continue;
      }

      if (msg.role === 'assistant') {
        const textParts  = (msg.content ?? []).filter(p => p.type === 'text');
        const toolCalls  = (msg.content ?? []).filter(p => p.type === 'tool_call');
        const native = { role: 'assistant' };

        if (textParts.length > 0) native.content = textParts.map(p => p.text).join('');
        if (toolCalls.length > 0) {
          native.tool_calls = toolCalls.map(tc => ({
            id:       tc.id,
            type:     'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          }));
        }

        messages.push(native);
        continue;
      }

      // user
      const content = this.#flattenContent(msg.content);
      messages.push({ role: 'user', content });
    }

    const native = {
      model:      req.model ?? this.defaultModel,
      max_tokens: req.maxTokens ?? 4096,
      messages,
    };

    if (req.tools?.length > 0) {
      native.tools = req.tools.map(t => ({
        type:     'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      native.tool_choice = 'auto';
    }

    if (req.temperature !== undefined) native.temperature = req.temperature;

    return native;
  }

  #flattenContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    // Multi-modal content array
    const parts = content.map(p => {
      if (p.type === 'text')  return { type: 'text', text: p.text };
      if (p.type === 'image') return { type: 'image_url', image_url: { url: p.url ?? `data:${p.mediaType};base64,${p.data}` } };
      return null;
    }).filter(Boolean);

    return parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
  }

  #fromNative(resp, model) {
    const choice  = resp.choices?.[0];
    const message = choice?.message ?? {};
    const content = [];

    if (message.content) content.push({ type: 'text', text: message.content });

    for (const tc of message.tool_calls ?? []) {
      let input;
      try { input = JSON.parse(tc.function.arguments); } catch { input = {}; }
      content.push({ type: 'tool_call', id: tc.id, name: tc.function.name, input });
    }

    return {
      id:    resp.id,
      model: model ?? resp.model,
      content,
      usage: {
        inputTokens:           resp.usage?.prompt_tokens     ?? 0,
        outputTokens:          resp.usage?.completion_tokens ?? 0,
        cacheReadTokens:       0,
        cacheWriteTokens:      0,
      },
      stopReason: this.#mapStopReason(choice?.finish_reason),
    };
  }

  #mapStopReason(reason) {
    const map = { stop: 'end_turn', tool_calls: 'tool_use', length: 'max_tokens' };
    return map[reason] ?? reason;
  }

  #wrapError(err) {
    const status    = err.status ?? err.statusCode;
    const retryable = status === 429 || status >= 500;
    const wrapped   = new Error(err.message);
    wrapped.status    = status;
    wrapped.retryable = retryable;
    wrapped.provider  = 'openai';
    return wrapped;
  }
}
