// Node handler implementations.
// Each handler receives (node, context, services) and returns { status, output?, suggestedNext? }

function interpolate(template, context) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context.get(key);
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

function buildSystemPrompt(fidelity = 'compact') {
  if (fidelity === 'full') {
    return 'You are a coding agent. Use the available tools to complete the task. Reuse your full session context.';
  }
  if (fidelity.startsWith('summary')) {
    return 'You are a coding agent. Summarize prior context briefly before proceeding with the task.';
  }
  // compact (default)
  return 'You are a coding agent. Complete the given task using the available tools. Be concise and correct.';
}

export const HANDLERS = {
  // ── No-ops ──────────────────────────────────────────────────────────────
  start: async (node, context, services) => {
    services.emit('NODE_START', { id: node.id, handler: 'start' });
    return { status: 'SUCCESS' };
  },

  exit: async (node, context, services) => {
    services.emit('NODE_START', { id: node.id, handler: 'exit' });
    return { status: 'SUCCESS' };
  },

  // ── codergen: spawns a coding agent session ──────────────────────────────
  codergen: async (node, context, services) => {
    const { spawnSession, emit } = services;
    const prompt   = interpolate(node.attrs.prompt ?? 'Complete the task.', context);
    const fidelity = node.attrs.fidelity ?? 'compact';
    const model    = node.attrs.model ?? undefined;

    emit('NODE_START', { id: node.id, handler: 'codergen', prompt });

    const session = spawnSession({
      model,
      config: { systemPrompt: buildSystemPrompt(fidelity) },
    });

    let result;
    try {
      result = await session.run(prompt);
    } catch (err) {
      context.set(`${node.id}_error`, err.message);
      return { status: 'FAILURE', error: err.message };
    }

    context.set(`${node.id}_output`, result);
    context.set(`${node.id}_status`, 'SUCCESS');
    return { status: 'SUCCESS', output: result };
  },

  // ── wait.human: approval gate ────────────────────────────────────────────
  'wait.human': async (node, context, services) => {
    const { interviewer, emit } = services;
    const question = interpolate(node.attrs.question ?? 'Continue? (y/n)', context);
    const timeout  = node.attrs.timeout ? parseInt(node.attrs.timeout, 10) : null;
    const def      = node.attrs.default ?? null;

    emit('NODE_START', { id: node.id, handler: 'wait.human', question });

    const answer   = await interviewer.ask(question, { timeout, default: def });
    const approved = /^(y|yes|approve|ok|1|true)$/i.test(answer.trim());

    context.set(`${node.id}_answer`,   answer);
    context.set(`${node.id}_approved`, approved);

    return { status: approved ? 'SUCCESS' : 'FAILURE' };
  },

  // ── condition: evaluate a JS expression against context ──────────────────
  condition: async (node, context, services) => {
    const expr   = node.attrs.condition ?? 'true';
    const result = context.evaluate(expr);
    services.emit('NODE_START', { id: node.id, handler: 'condition', expr, result });
    return { status: result ? 'SUCCESS' : 'FAILURE' };
  },

  // ── tool: execute a specific tool directly ───────────────────────────────
  tool: async (node, context, services) => {
    const { executionEnv, profile, emit } = services;
    const toolName = node.attrs.tool;
    if (!toolName) throw new Error(`Node '${node.id}': missing 'tool' attribute`);

    const rawInput = node.attrs.input ? interpolate(node.attrs.input, context) : '{}';
    let input;
    try { input = JSON.parse(rawInput); } catch { input = {}; }

    emit('NODE_START', { id: node.id, handler: 'tool', tool: toolName });

    const tool = profile?.tools?.find(t => t.name === toolName);
    if (!tool) throw new Error(`Tool '${toolName}' not found in profile`);

    const output = await tool.execute(input, executionEnv);
    context.set(`${node.id}_output`, output);
    return { status: 'SUCCESS', output };
  },

  // ── parallel: fan-out marker — the engine handles actual parallelism ─────
  parallel: async (node, context, services) => {
    services.emit('NODE_START', { id: node.id, handler: 'parallel' });
    return { status: 'SUCCESS' };
  },

  // ── manager: supervision loop around a codergen ──────────────────────────
  manager: async (node, context, services) => {
    const maxIter = parseInt(node.attrs.max_iterations ?? '5', 10);
    let lastResult = { status: 'FAILURE' };

    for (let i = 0; i < maxIter; i++) {
      lastResult = await HANDLERS.codergen(node, context, services);
      if (lastResult.status === 'SUCCESS') break;
    }

    return lastResult;
  },
};
