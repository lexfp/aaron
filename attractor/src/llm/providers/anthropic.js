import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider {
  #client;

  constructor(options = {}) {
    this.#client = new Anthropic({
      apiKey: options.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.defaultModel = options.defaultModel ?? 'claude-sonnet-4-6';
  }

  async complete(request) {
    const native = this.#toNative(request);
    let response;
    try {
      response = await this.#client.messages.create(native);
    } catch (err) {
      throw this.#wrapError(err);
    }
    return this.#fromNative(response);
  }

  async *stream(request) {
    const native = { ...this.#toNative(request), stream: true };
    const stream = await this.#client.messages.create(native);
    let fullText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        fullText += event.delta.text;
        yield { type: 'text_delta', text: event.delta.text };
      }
    }

    const finalMsg = await stream.finalMessage();
    yield { type: 'message_end', message: this.#fromNative(finalMsg) };
  }

  // ── Conversion helpers ──────────────────────────────────────────────────

  #toNative(req) {
    // Separate system messages from conversation history
    const systemParts = [];
    const messages = [];

    for (const msg of req.messages ?? []) {
      if (msg.role === 'system') {
        for (const part of msg.content ?? []) {
          if (part.type === 'text') {
            systemParts.push({ type: 'text', text: part.text, cache_control: { type: 'ephemeral' } });
          }
        }
        continue;
      }

      if (msg.role === 'tool_results') {
        // Tool results must be sent as a user message
        messages.push({
          role: 'user',
          content: msg.content.map(r => ({
            type: 'tool_result',
            tool_use_id: r.id,
            content: r.content,
            is_error: r.isError ?? false,
          })),
        });
        continue;
      }

      if (msg.role === 'steering') {
        messages.push({ role: 'user', content: msg.content });
        continue;
      }

      // user / assistant
      messages.push({
        role: msg.role,
        content: (msg.content ?? []).map(p => this.#toNativePart(p)),
      });
    }

    const native = {
      model:      req.model ?? this.defaultModel,
      max_tokens: req.maxTokens ?? 8192,
      messages,
    };

    if (systemParts.length > 0) native.system = systemParts;

    if (req.tools?.length > 0) {
      native.tools = req.tools.map(t => ({
        name:         t.name,
        description:  t.description,
        input_schema: t.parameters,
      }));
    }

    if (req.temperature !== undefined) native.temperature = req.temperature;

    return native;
  }

  #toNativePart(part) {
    if (part.type === 'text')      return { type: 'text', text: part.text };
    if (part.type === 'tool_call') return { type: 'tool_use', id: part.id, name: part.name, input: part.input };
    if (part.type === 'image') {
      if (part.url) return { type: 'image', source: { type: 'url', url: part.url } };
      return { type: 'image', source: { type: 'base64', media_type: part.mediaType ?? 'image/png', data: part.data } };
    }
    return part;
  }

  #fromNative(resp) {
    const content = (resp.content ?? []).map(block => {
      if (block.type === 'text')     return { type: 'text', text: block.text };
      if (block.type === 'tool_use') return { type: 'tool_call', id: block.id, name: block.name, input: block.input };
      return block;
    });

    return {
      id:         resp.id,
      model:      resp.model,
      content,
      usage: {
        inputTokens:      resp.usage?.input_tokens  ?? 0,
        outputTokens:     resp.usage?.output_tokens ?? 0,
        cacheReadTokens:  resp.usage?.cache_read_input_tokens  ?? 0,
        cacheWriteTokens: resp.usage?.cache_creation_input_tokens ?? 0,
      },
      stopReason: this.#mapStopReason(resp.stop_reason),
    };
  }

  #mapStopReason(reason) {
    const map = { end_turn: 'end_turn', tool_use: 'tool_use', max_tokens: 'max_tokens' };
    return map[reason] ?? reason;
  }

  #wrapError(err) {
    const retryable = err.status === 429 || err.status >= 500;
    const wrapped = new Error(err.message);
    wrapped.status = err.status;
    wrapped.retryable = retryable;
    wrapped.provider = 'anthropic';
    return wrapped;
  }
}
