// Model catalog: metadata for selecting models without hallucinating identifiers.
export const MODELS = {
  // Anthropic
  'claude-opus-4-7':       { provider: 'anthropic', contextWindow: 200000, outputTokens: 32000, supportsVision: true,  supportsTools: true,  pricing: { input: 15,   output: 75   } },
  'claude-sonnet-4-6':     { provider: 'anthropic', contextWindow: 200000, outputTokens: 8192,  supportsVision: true,  supportsTools: true,  pricing: { input: 3,    output: 15   } },
  'claude-haiku-4-5-20251001': { provider: 'anthropic', contextWindow: 200000, outputTokens: 8192, supportsVision: true, supportsTools: true, pricing: { input: 0.8, output: 4 } },

  // OpenAI
  'gpt-4o':        { provider: 'openai', contextWindow: 128000, outputTokens: 16384, supportsVision: true,  supportsTools: true,  pricing: { input: 2.5,  output: 10   } },
  'gpt-4o-mini':   { provider: 'openai', contextWindow: 128000, outputTokens: 16384, supportsVision: true,  supportsTools: true,  pricing: { input: 0.15, output: 0.6  } },
  'o3':            { provider: 'openai', contextWindow: 200000, outputTokens: 100000, supportsVision: false, supportsTools: true, supportsReasoning: true, pricing: { input: 10, output: 40 } },
  'o4-mini':       { provider: 'openai', contextWindow: 200000, outputTokens: 100000, supportsVision: true,  supportsTools: true, supportsReasoning: true, pricing: { input: 1.1, output: 4.4 } },

  // Google Gemini
  'gemini-2.5-pro':   { provider: 'gemini', contextWindow: 1048576, outputTokens: 8192, supportsVision: true, supportsTools: true, pricing: { input: 1.25, output: 10 } },
  'gemini-2.0-flash': { provider: 'gemini', contextWindow: 1048576, outputTokens: 8192, supportsVision: true, supportsTools: true, pricing: { input: 0.1,  output: 0.4 } },
};

export function lookupModel(modelId) {
  return MODELS[modelId] ?? null;
}

export function resolveProvider(modelId) {
  const entry = MODELS[modelId];
  if (entry) return entry.provider;
  if (modelId.startsWith('claude'))  return 'anthropic';
  if (modelId.startsWith('gpt') || modelId.startsWith('o3') || modelId.startsWith('o4') || modelId.startsWith('o1')) return 'openai';
  if (modelId.startsWith('gemini'))  return 'gemini';
  throw new Error(`Cannot determine provider for model: ${modelId}`);
}
