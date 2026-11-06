# attractor — reference

Moved out of `CLAUDE.md` (which keeps only the rules). `platformer/attractor/` is a DOT-based AI pipeline orchestrator (Node.js ESM). All paths below are relative to the repo root unless shown otherwise.

## Run

No build step. Run pipelines with `node platformer/attractor/attractor.js <pipeline.dot>`.

**Three spec layers implemented:**
1. **Unified LLM Client** (`src/llm/`) — provider-agnostic wrapper for Anthropic, OpenAI, and Gemini. Auto-initializes from env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`). Middleware support, exponential-backoff retry, streaming.
2. **Coding Agent Loop** (`src/agent/`) — `Session` class with agentic loop: tool execution (concurrent), character-first output truncation, event system, steering injection, loop detection, subagent spawning.
3. **Pipeline Engine** (`src/pipeline/`) — DOT language pipelines with 6 phases (Parse→Transform→Validate→Initialize→Execute→Finalize), 7 node handler types, 5-level edge selection, goal gates, per-node retry with exponential backoff, checkpoint/resume, human-in-the-loop via `CLIInterviewer`.

**File layout:**
```
platformer/attractor/
  attractor.js              CLI entry point
  src/
    index.js                re-exports everything
    llm/
      catalog.js            MODELS map with capabilities + pricing
      client.js             LLMClient (router + middleware + retry)
      providers/
        anthropic.js        Anthropic native API adapter (prompt caching)
        openai.js           OpenAI native API adapter
        gemini.js           Gemini native API adapter
    agent/
      session.js            Session (the coding agent loop)
      events.js             Event types + EventEmitter
      truncation.js         Character-first + line-based truncation
      execution-env.js      LocalExecutionEnvironment (file/shell/glob/grep)
      tools/
        core.js             read_file, write_file, shell, glob, grep, list_dir
        profiles.js         Provider profiles: anthropic (edit_file), openai (apply_patch), gemini (search_and_replace)
    pipeline/
      engine.js             PipelineEngine (6-phase orchestrator)
      dot-parser.js         Recursive-descent DOT parser
      validator.js          Pipeline linter (errors + warnings)
      context.js            PipelineContext (key-value + JS expression eval)
      checkpoint.js         CheckpointManager (JSON file save/resume)
      handlers.js           HANDLERS: start, exit, codergen, wait.human, condition, tool, parallel, manager
      interviewer.js        CLIInterviewer + NoopInterviewer
  examples/
    hello.dot               Human-in-the-loop review pattern
    coding-task.dot         Analyze → propose → approve → implement pipeline
    platformer/
      analyze.dot           Read all platformer JS modules → review → write ARCHITECTURE.md
      level-review.dot      Analyze a specific archetype's balance/physics (--var archetype=standard)
      add-enemy.dot         Design + implement a new enemy type (--var enemy_type=patrol_slime)
      balance.dot           Audit upgrade costs and progression curve
  tests/
    dot-parser.test.js      29 tests for the DOT tokenizer/parser
    validator.test.js       18 tests for pipeline linting rules
    context.test.js         31 tests for PipelineContext (get/set/evaluate/snapshot)
    checkpoint.test.js      10 tests for CheckpointManager (save/load/clear)
    interviewer.test.js     9 tests for NoopInterviewer + CLIInterviewer
    handlers.test.js        22 tests for all HANDLERS (start/exit/condition/wait.human/codergen/manager)
    engine.test.js          25 tests for PipelineEngine (routing, edge selection, retries, checkpoints)
```

**Node handlers:** `start` / `exit` (no-op), `codergen` (spawns Session with prompt), `wait.human` (CLI approval gate), `condition` (evaluates JS expression against context), `tool` (runs a profile tool directly), `parallel` (fan-out marker), `manager` (supervision loop).

**Edge selection priority:** condition match → preferred label → suggestedNext from handler → highest weight → lexical order.

**Context variables set by handlers:** `{nodeId}_status`, `{nodeId}_output`, `{nodeId}_approved`, `{nodeId}_answer`, `{nodeId}_error`.

**Testing:** Uses Node.js built-in `node:test` (no extra deps, ESM-native). 144 tests, 0 failures.
- `codergen` catches session errors internally → returns FAILURE status (engine does NOT retry it)
- `tool` handler throws on missing tool → engine retry loop fires; use for testing retry logic
- Multiple `handler="exit"` nodes fail validation — branch tests use codergen nodes sharing one exit

```bash
cd platformer/attractor && npm install   # first time only
npm test                      # run all 144 tests
node attractor.js examples/hello.dot
node attractor.js examples/platformer/analyze.dot
node attractor.js examples/platformer/level-review.dot --var archetype=zigzag
node attractor.js examples/platformer/add-enemy.dot --var enemy_type=bouncer
node attractor.js examples/platformer/balance.dot
node attractor.js examples/coding-task.dot --var target=src/ --checkpoint --debug
```
