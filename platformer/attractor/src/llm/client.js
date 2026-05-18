import { resolveProvider, lookupModel } from './catalog.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider }    from './providers/openai.js';
import { GeminiProvider }    from './providers/gemini.js';

const DEFAULT_RETRY = { maxAttempts: 3, baseDelay: 500, maxDelay: 30_000 };

// ── Layer 3: Core client ────────────────────────────────────────────────────
export class LLMClient {
  #providers   = new Map(); // providerName -> adapter
  #middleware  = [];
  #retryPolicy = { ...DEFAULT_RETRY };

  constructor(options = {}) {
    // Auto-initialize providers when env vars are present
    if (process.env.ANTHROPIC_API_KEY || options.anthropic) {
      this.addProvider('anthropic', new AnthropicProvider(options.anthropic ?? {}));
    }
    if (process.env.OPENAI_API_KEY || options.openai) {
      this.addProvider('openai', new OpenAIProvider(options.openai ?? {}));
    }
    if ((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) || options.gemini) {
      this.addProvider('gemini', new GeminiProvider(options.gemini ?? {}));
    }

    if (options.retryPolicy) Object.assign(this.#retryPolicy, options.retryPolicy);
  }

  addProvider(name, adapter) {
    this.#providers.set(name, adapter);
    return this;
  }

  /** Add a middleware function: (request, next) => Promise<response> */
  use(middleware) {
    this.#middleware.push(middleware);
    return this;
  }

  async complete(request) {
    const chain = this.#buildChain(req => this.#dispatch(req));
    return chain(request);
  }

  async *stream(request) {
    const provider = this.#getProvider(request.model);
    if (typeof provider.stream !== 'function') {
      // Fall back to complete() if provider doesn't implement streaming
      const resp = await this.complete(request);
      yield { type: 'message_end', message: resp };
      return;
    }
    yield* provider.stream(request);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  async #dispatch(request) {
    const provider = this.#getProvider(request.model);
    return this.#withRetry(() => provider.complete(request));
  }

  #getProvider(model) {
    const providerName = resolveProvider(model);
    const provider     = this.#providers.get(providerName);
    if (!provider) {
      throw new Error(
        `No provider registered for '${providerName}'. ` +
        `Set ${providerName.toUpperCase()}_API_KEY or pass options.${providerName}.`
      );
    }
    return provider;
  }

  #buildChain(final) {
    return this.#middleware.reduceRight(
      (next, mw) => (req) => mw(req, next),
      final,
    );
  }

  async #withRetry(fn) {
    let lastErr;
    const { maxAttempts, baseDelay, maxDelay } = this.#retryPolicy;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!err.retryable || attempt === maxAttempts - 1) throw err;

        const delay = Math.min(baseDelay * Math.pow(2, attempt) * (1 + Math.random() * 0.1), maxDelay);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastErr;
  }
}
