// Attractor — DOT-based AI pipeline orchestration
// Unified LLM Client + Coding Agent Loop + Pipeline Engine

export { LLMClient }            from './llm/client.js';
export { AnthropicProvider }    from './llm/providers/anthropic.js';
export { OpenAIProvider }       from './llm/providers/openai.js';
export { GeminiProvider }       from './llm/providers/gemini.js';
export { MODELS, lookupModel, resolveProvider } from './llm/catalog.js';

export { Session }              from './agent/session.js';
export { Events, EventEmitter } from './agent/events.js';
export { truncate }             from './agent/truncation.js';
export { LocalExecutionEnvironment } from './agent/execution-env.js';
export { getProfile, PROFILES } from './agent/tools/profiles.js';
export { CORE_TOOLS }           from './agent/tools/core.js';

export { PipelineEngine }       from './pipeline/engine.js';
export { parseDot }             from './pipeline/dot-parser.js';
export { validate }             from './pipeline/validator.js';
export { PipelineContext }      from './pipeline/context.js';
export { CheckpointManager }    from './pipeline/checkpoint.js';
export { CLIInterviewer, NoopInterviewer } from './pipeline/interviewer.js';
export { HANDLERS }             from './pipeline/handlers.js';
