import { EventEmitter, Events } from './events.js';
import { truncate } from './truncation.js';
import { LocalExecutionEnvironment } from './execution-env.js';
import { getProfile } from './tools/profiles.js';

const DEFAULT_CONFIG = {
  maxToolRoundsPerInput: 50,
  maxTurns:              200,
  loopDetectionWindow:   10,
  systemPrompt:          '',
};

// ── Session: the coding agent loop ────────────────────────────────────────────
export class Session extends EventEmitter {
  #history          = [];
  #state            = 'IDLE';   // IDLE | PROCESSING | CLOSED
  #steeringQueue    = [];
  #followUpQueue    = [];
  #abortController  = null;
  #totalTurns       = 0;
  #sigHistory       = [];       // for loop detection
  #depth            = 0;        // subagent depth

  constructor(options = {}) {
    super();
    this.llmClient     = options.llmClient;
    this.model         = options.model ?? 'claude-sonnet-4-6';
    this.executionEnv  = options.executionEnv ?? new LocalExecutionEnvironment();
    this.profile       = getProfile(options.profile);
    this.config        = { ...DEFAULT_CONFIG, ...(options.config ?? {}) };
    this.#depth        = options._depth ?? 0;

    if (!this.llmClient) throw new Error('Session requires an llmClient');
  }

  get state() { return this.#state; }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Queue a steering message to be injected after the current tool round. */
  steer(message) {
    this.#steeringQueue.push(message);
  }

  /** Queue a message to be processed after the current input completes. */
  follow_up(message) {
    this.#followUpQueue.push(message);
  }

  /** Abort the current run. */
  abort() {
    this.#abortController?.abort();
  }

  /** Close the session permanently. */
  close() {
    this.abort();
    this.#state = 'CLOSED';
    this.emit(Events.SESSION_END, {});
  }

  /** Spawn a child session sharing the execution environment. */
  spawn(options = {}) {
    if (this.#depth >= (this.config.maxSubagentDepth ?? 1)) {
      throw new Error('Maximum subagent depth reached');
    }
    return new Session({
      llmClient:    this.llmClient,
      executionEnv: this.executionEnv,
      profile:      options.profile ?? this.profile.name,
      model:        options.model   ?? this.model,
      config:       options.config  ?? this.config,
      _depth:       this.#depth + 1,
    });
  }

  /** Run the agent with a user input string. Returns the final assistant text. */
  async run(userInput) {
    if (this.#state === 'CLOSED') throw new Error('Session is closed');
    if (this.#state === 'PROCESSING') throw new Error('Session is already processing');

    this.#state           = 'PROCESSING';
    this.#abortController = new AbortController();
    this.emit(Events.SESSION_START, { model: this.model });
    this.emit(Events.USER_INPUT, { content: userInput });

    this.#history.push({ role: 'user', content: [{ type: 'text', text: userInput }] });

    let finalText = '';
    try {
      finalText = await this.#loop();
    } finally {
      this.#state = 'IDLE';
    }

    // Process follow-ups sequentially
    const followUps = this.#followUpQueue.splice(0);
    for (const msg of followUps) {
      await this.run(msg);
    }

    return finalText;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  async #loop() {
    const signal = this.#abortController.signal;
    let rounds   = 0;
    let lastText = '';

    while (true) {
      if (signal.aborted) break;
      if (rounds >= this.config.maxToolRoundsPerInput) {
        this.emit(Events.ROUND_LIMIT_REACHED, { rounds });
        break;
      }
      if (this.#totalTurns >= this.config.maxTurns) {
        this.emit(Events.TURN_LIMIT_REACHED, { turns: this.#totalTurns });
        break;
      }

      // 1. Build request
      const request = this.#buildRequest();

      // 2. Call LLM
      let response;
      try {
        response = await this.llmClient.complete(request);
      } catch (err) {
        this.emit(Events.ERROR, { error: err.message, retryable: err.retryable });
        if (!err.retryable) throw err;
        break;
      }

      this.#totalTurns++;

      // 3. Record assistant message
      this.#history.push({ role: 'assistant', content: response.content });

      // 4. Emit text
      const textParts = response.content.filter(p => p.type === 'text');
      lastText = textParts.map(p => p.text).join('');
      if (lastText) this.emit(Events.ASSISTANT_TEXT_END, { text: lastText });

      // 5. Natural completion check
      const toolCalls = response.content.filter(p => p.type === 'tool_call');
      if (toolCalls.length === 0) break;

      // 6. Loop detection
      if (this.#isLoop(toolCalls)) {
        const warning = 'You appear to be repeating the same tool calls. Try a different approach.';
        this.#steeringQueue.unshift(warning);
        this.emit(Events.LOOP_DETECTED, { signature: this.#sigHistory.at(-1) });
      }

      // 7. Execute tools (concurrent)
      const toolResults = await this.#executeTools(toolCalls, signal);
      this.#history.push({ role: 'tool_results', content: toolResults });

      // 8. Inject steering messages
      while (this.#steeringQueue.length > 0) {
        const msg = this.#steeringQueue.shift();
        this.#history.push({ role: 'steering', content: [{ type: 'text', text: msg }] });
        this.emit(Events.STEERING_INJECTED, { message: msg });
      }

      rounds++;
    }

    return lastText;
  }

  async #executeTools(toolCalls, signal) {
    return Promise.all(toolCalls.map(async (call) => {
      if (signal?.aborted) {
        return { type: 'tool_result', id: call.id, content: 'Aborted', isError: true };
      }

      this.emit(Events.TOOL_CALL_START, { id: call.id, name: call.name, input: call.input });

      try {
        const tool = this.profile.tools.find(t => t.name === call.name);
        if (!tool) throw new Error(`Unknown tool: ${call.name}`);

        const rawOutput  = await tool.execute(call.input, this.executionEnv);
        const output     = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput, null, 2);
        const truncated  = truncate(output, call.name);

        this.emit(Events.TOOL_CALL_END, { id: call.id, name: call.name, output }); // full output
        return { type: 'tool_result', id: call.id, content: truncated, isError: false };
      } catch (err) {
        this.emit(Events.TOOL_CALL_END, { id: call.id, name: call.name, error: err.message });
        return { type: 'tool_result', id: call.id, content: `Error: ${err.message}`, isError: true };
      }
    }));
  }

  #buildRequest() {
    const messages = [];

    if (this.config.systemPrompt) {
      messages.push({ role: 'system', content: [{ type: 'text', text: this.config.systemPrompt }] });
    }

    for (const turn of this.#history) {
      if (turn.role === 'steering') {
        // Convert steering to user message for the LLM
        messages.push({ role: 'user', content: turn.content });
      } else {
        messages.push(turn);
      }
    }

    return {
      model:     this.model,
      messages,
      tools:     this.profile.tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
      maxTokens: this.config.maxTokens ?? 8192,
    };
  }

  #isLoop(toolCalls) {
    const sig = toolCalls.map(c => `${c.name}:${JSON.stringify(c.input)}`).join('|');
    this.#sigHistory.push(sig);

    const w = this.config.loopDetectionWindow;
    if (this.#sigHistory.length < w * 2) return false;

    const recent = this.#sigHistory.slice(-w).join('→');
    const prev   = this.#sigHistory.slice(-w * 2, -w).join('→');
    return recent === prev;
  }
}
