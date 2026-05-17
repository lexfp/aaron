import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export class GeminiProvider {
  #genAI;

  constructor(options = {}) {
    this.#genAI = new GoogleGenerativeAI(options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY);
    this.defaultModel = options.defaultModel ?? 'gemini-2.0-flash';
  }

  async complete(request) {
    const { model: modelId, systemInstruction, history, lastUserMessage, tools } = this.#toNative(request);

    const modelConfig = { model: modelId, safetySettings: SAFETY_SETTINGS };
    if (systemInstruction) modelConfig.systemInstruction = systemInstruction;
    if (tools?.length > 0)  modelConfig.tools = [{ functionDeclarations: tools }];

    const model  = this.#genAI.getGenerativeModel(modelConfig);
    const chat   = model.startChat({ history });

    let resp;
    try {
      resp = await chat.sendMessage(lastUserMessage);
    } catch (err) {
      throw this.#wrapError(err);
    }

    return this.#fromNative(resp, modelId);
  }

  async *stream(request) {
    const { model: modelId, systemInstruction, history, lastUserMessage, tools } = this.#toNative(request);

    const modelConfig = { model: modelId, safetySettings: SAFETY_SETTINGS };
    if (systemInstruction) modelConfig.systemInstruction = systemInstruction;
    if (tools?.length > 0)  modelConfig.tools = [{ functionDeclarations: tools }];

    const model = this.#genAI.getGenerativeModel(modelConfig);
    const chat  = model.startChat({ history });
    const resp  = await chat.sendMessageStream(lastUserMessage);

    let fullText = '';
    for await (const chunk of resp.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        yield { type: 'text_delta', text };
      }
    }

    const final = await resp.response;
    yield { type: 'message_end', message: this.#fromNative({ response: final }, modelId) };
  }

  // ── Conversion helpers ──────────────────────────────────────────────────

  #toNative(req) {
    let systemInstruction = null;
    const history = [];
    let lastUserMessage = [];

    const msgs = req.messages ?? [];

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];

      if (msg.role === 'system') {
        systemInstruction = (msg.content ?? []).map(p => p.text ?? '').join('');
        continue;
      }

      if (msg.role === 'tool_results') {
        // Gemini: function response comes back as user role
        const parts = msg.content.map(r => ({
          functionResponse: { name: r.name ?? 'tool', response: { result: r.content } },
        }));
        const isLast = i === msgs.length - 1;
        if (isLast) { lastUserMessage = parts; } else { history.push({ role: 'user', parts }); }
        continue;
      }

      if (msg.role === 'steering') {
        const parts = [{ text: (msg.content ?? []).map(p => p.text ?? '').join('') }];
        const isLast = i === msgs.length - 1;
        if (isLast) { lastUserMessage = parts; } else { history.push({ role: 'user', parts }); }
        continue;
      }

      const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      const parts = this.#toParts(msg.content ?? []);
      const isLast = i === msgs.length - 1 && geminiRole === 'user';

      if (isLast) {
        lastUserMessage = parts;
      } else {
        history.push({ role: geminiRole, parts });
      }
    }

    const tools = (req.tools ?? []).map(t => ({
      name:        t.name,
      description: t.description,
      parameters:  t.parameters,
    }));

    return {
      model:      req.model ?? this.defaultModel,
      systemInstruction,
      history,
      lastUserMessage,
      tools,
    };
  }

  #toParts(content) {
    return content.map(p => {
      if (p.type === 'text')      return { text: p.text };
      if (p.type === 'tool_call') return { functionCall: { name: p.name, args: p.input } };
      if (p.type === 'image')     return { inlineData: { mimeType: p.mediaType ?? 'image/png', data: p.data } };
      return { text: JSON.stringify(p) };
    });
  }

  #fromNative(resp, modelId) {
    const response = resp.response ?? resp;
    const candidates = response.candidates ?? [];
    const candidate  = candidates[0];
    const content    = [];

    for (const part of candidate?.content?.parts ?? []) {
      if (part.text)          content.push({ type: 'text', text: part.text });
      if (part.functionCall)  content.push({ type: 'tool_call', id: `fc_${Date.now()}`, name: part.functionCall.name, input: part.functionCall.args ?? {} });
    }

    const usage   = response.usageMetadata ?? {};
    const finish  = candidate?.finishReason;

    return {
      id:         `gemini_${Date.now()}`,
      model:      modelId,
      content,
      usage: {
        inputTokens:      usage.promptTokenCount     ?? 0,
        outputTokens:     usage.candidatesTokenCount ?? 0,
        cacheReadTokens:  0,
        cacheWriteTokens: 0,
      },
      stopReason: finish === 'STOP' ? 'end_turn' : finish === 'MAX_TOKENS' ? 'max_tokens' : 'tool_use',
    };
  }

  #wrapError(err) {
    const retryable = err.status === 429 || (err.status ?? 0) >= 500;
    const wrapped   = new Error(err.message ?? String(err));
    wrapped.status    = err.status;
    wrapped.retryable = retryable;
    wrapped.provider  = 'gemini';
    return wrapped;
  }
}
