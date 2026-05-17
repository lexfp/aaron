import { parseDot }         from './dot-parser.js';
import { validate }         from './validator.js';
import { PipelineContext }  from './context.js';
import { CheckpointManager } from './checkpoint.js';
import { HANDLERS }         from './handlers.js';
import { CLIInterviewer }   from './interviewer.js';
import { Session }          from '../agent/session.js';
import { getProfile }       from '../agent/tools/profiles.js';
import { LocalExecutionEnvironment } from '../agent/execution-env.js';

function retryDelay(attempt, cfg = {}) {
  const base   = cfg.baseDelay  ?? 200;
  const max    = cfg.maxDelay   ?? 60_000;
  const jitter = Math.random() * 0.1;
  return Math.min(base * Math.pow(2, attempt) * (1 + jitter), max);
}

// ── PipelineEngine ─────────────────────────────────────────────────────────────
export class PipelineEngine {
  constructor(options = {}) {
    this.llmClient    = options.llmClient    ?? null;
    this.interviewer  = options.interviewer  ?? new CLIInterviewer();
    this.executionEnv = options.executionEnv ?? new LocalExecutionEnvironment();
    this.profile      = getProfile(options.profile);
    this.onEvent      = options.onEvent      ?? ((type, data) => {
      if (process.env.ATTRACTOR_DEBUG) console.log(`[pipeline:${type}]`, data);
    });
  }

  /**
   * Run a pipeline defined in DOT source.
   * @param {string}  dotSource       DOT language pipeline definition
   * @param {object}  initialContext  Initial key-value context
   * @param {object}  options         { variables, checkpoint, checkpointPath }
   * @returns {object} Final context snapshot
   */
  async run(dotSource, initialContext = {}, options = {}) {
    // Phase 1: Parse
    let graph;
    try {
      graph = parseDot(dotSource);
    } catch (err) {
      throw new Error(`DOT parse error: ${err.message}`);
    }

    // Phase 2: Transform — variable expansion and stylesheet application
    this.#transform(graph, options.variables ?? {});

    // Phase 3: Validate
    const validation = validate(graph);
    for (const w of validation.warnings) {
      this.onEvent('VALIDATION_WARNING', { message: w });
    }
    if (!validation.valid) {
      throw new Error(`Pipeline validation failed:\n  ${validation.errors.join('\n  ')}`);
    }

    // Phase 4: Initialize
    const context        = new PipelineContext(initialContext);
    const checkpointMgr  = options.checkpoint ? new CheckpointManager(options.checkpointPath) : null;

    let completedNodes   = new Set();
    let retryCounts      = {};

    // Resume from checkpoint if available
    if (checkpointMgr) {
      const saved = await checkpointMgr.load();
      if (saved) {
        context.restore(saved.context);
        completedNodes = new Set(saved.completedNodes ?? []);
        retryCounts    = saved.retryCounts ?? {};
        this.onEvent('CHECKPOINT_RESUMED', { completedCount: completedNodes.size });
      }
    }

    // Phase 5: Execute
    const startNode  = [...graph.nodes.values()].find(n => n.attrs.handler === 'start');
    const goalGates  = [...graph.nodes.values()].filter(n => n.attrs.goal_gate === 'true');

    if (!startNode) throw new Error('No start node (this should have been caught by validator)');

    await this.#execute(startNode, graph, context, completedNodes, retryCounts, checkpointMgr);

    // Phase 6: Finalize — check goal gates
    const unsatisfied = goalGates.filter(n => context.get(`${n.id}_status`) !== 'SUCCESS');
    if (unsatisfied.length > 0) {
      throw new Error(`Goal gates not satisfied: ${unsatisfied.map(n => n.id).join(', ')}`);
    }

    if (checkpointMgr) await checkpointMgr.clear();

    this.onEvent('PIPELINE_COMPLETE', { context: context.snapshot() });
    return context.snapshot();
  }

  // ── Execution ──────────────────────────────────────────────────────────────

  async #execute(node, graph, context, completedNodes, retryCounts, checkpoint) {
    if (!node) return;

    // Resume: skip already-completed nodes but still follow edges
    if (completedNodes.has(node.id)) {
      const outEdges = graph.edges.filter(e => e.from === node.id);
      const nextId   = this.#selectEdge(outEdges, context, { status: 'SUCCESS' }, node);
      if (nextId) await this.#execute(graph.nodes.get(nextId), graph, context, completedNodes, retryCounts, checkpoint);
      return;
    }

    const handlerName = node.attrs.handler;
    const handler     = HANDLERS[handlerName];
    if (!handler) throw new Error(`Unknown handler '${handlerName}' on node '${node.id}'`);

    // Build services object
    const services = {
      llmClient:    this.llmClient,
      interviewer:  this.interviewer,
      executionEnv: this.executionEnv,
      profile:      this.profile,
      emit: (type, data) => this.onEvent(type, { nodeId: node.id, ...data }),
      spawnSession: (opts = {}) => {
        if (!this.llmClient) throw new Error('No llmClient configured — cannot spawn coding agent');
        return new Session({
          llmClient:    this.llmClient,
          executionEnv: this.executionEnv,
          profile:      this.profile.name,
          ...opts,
        });
      },
    };

    // Retry policy (per-node overrides)
    const retryCfg = {
      maxAttempts: parseInt(node.attrs.max_attempts ?? '3', 10),
      baseDelay:   200,
      maxDelay:    60_000,
    };

    let result;
    let attempt = retryCounts[node.id] ?? 0;

    while (true) {
      try {
        result = await handler(node, context, services);
        break;
      } catch (err) {
        attempt++;
        retryCounts[node.id] = attempt;
        this.onEvent('NODE_ERROR', { nodeId: node.id, attempt, error: err.message });

        if (attempt >= retryCfg.maxAttempts) {
          result = { status: 'FAILURE', error: err.message };
          break;
        }

        const delay = retryDelay(attempt, retryCfg);
        this.onEvent('NODE_RETRY', { nodeId: node.id, attempt, delay });
        await new Promise(r => setTimeout(r, delay));
      }
    }

    context.set(`${node.id}_status`, result.status);
    completedNodes.add(node.id);

    this.onEvent('NODE_COMPLETE', { nodeId: node.id, status: result.status });

    // Save checkpoint
    if (checkpoint) {
      await checkpoint.save({
        context:        context.snapshot(),
        completedNodes: [...completedNodes],
        retryCounts,
        currentNode:    node.id,
      });
    }

    // Exit node — stop traversal
    if (handlerName === 'exit') return;

    // Select next node via edge selection algorithm
    const outEdges = graph.edges.filter(e => e.from === node.id);
    const nextId   = this.#selectEdge(outEdges, context, result, node);

    if (nextId) {
      await this.#execute(graph.nodes.get(nextId), graph, context, completedNodes, retryCounts, checkpoint);
    }
  }

  // ── Edge selection (priority order per spec) ───────────────────────────────

  #selectEdge(edges, context, result, node) {
    if (edges.length === 0) return null;

    // 1. Condition matching — first edge whose condition evaluates truthy
    for (const edge of edges) {
      if (edge.attrs.condition && context.evaluate(edge.attrs.condition)) {
        return edge.to;
      }
    }

    // If any edges had conditions but none matched, don't fall through to unconditional ones
    // (only skip if ALL edges have conditions — if some are unconditional, proceed)
    const hasConditions    = edges.some(e => e.attrs.condition);
    const unconditional    = edges.filter(e => !e.attrs.condition);
    const candidateEdges   = hasConditions && unconditional.length === 0 ? [] : unconditional;
    const pool             = candidateEdges.length > 0 ? candidateEdges : edges.filter(e => !e.attrs.condition);

    if (pool.length === 0) return null;

    // 2. Preferred label
    const preferred = node.attrs.preferred;
    if (preferred) {
      const match = pool.find(e => e.attrs.label === preferred);
      if (match) return match.to;
    }

    // 3. Suggested next from handler result
    if (result.suggestedNext?.length > 0) {
      const match = pool.find(e => result.suggestedNext.includes(e.to));
      if (match) return match.to;
    }

    // 4. Highest weight
    const weighted = pool.filter(e => e.attrs.weight !== undefined);
    if (weighted.length > 0) {
      return weighted.reduce((a, b) =>
        parseFloat(a.attrs.weight) >= parseFloat(b.attrs.weight) ? a : b
      ).to;
    }

    // 5. Lexical order on label or target node ID
    const sorted = [...pool].sort((a, b) => {
      const ka = a.attrs.label ?? a.to;
      const kb = b.attrs.label ?? b.to;
      return ka.localeCompare(kb);
    });
    return sorted[0].to;
  }

  // ── Transform phase ────────────────────────────────────────────────────────

  #transform(graph, variables) {
    const expand = (s) => {
      if (typeof s !== 'string') return s;
      return s.replace(/\$\{(\w+)\}/g, (_, k) => variables[k] ?? `\${${k}}`);
    };

    for (const node of graph.nodes.values()) {
      for (const [key, val] of Object.entries(node.attrs)) {
        node.attrs[key] = expand(val);
      }
    }
    for (const edge of graph.edges) {
      for (const [key, val] of Object.entries(edge.attrs)) {
        edge.attrs[key] = expand(val);
      }
    }
  }
}
