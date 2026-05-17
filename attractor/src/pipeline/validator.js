// Pipeline linter — enforces critical rules and emits warnings.

export function validate(graph) {
  const errors   = [];
  const warnings = [];

  const allNodes = [...graph.nodes.values()];
  const allEdges = graph.edges;

  // ── Errors (must fix) ─────────────────────────────────────────────────────

  const startNodes = allNodes.filter(n => n.attrs.handler === 'start');
  if (startNodes.length === 0) errors.push('No start node found. Add a node with handler="start".');
  if (startNodes.length > 1)  errors.push(`Multiple start nodes: ${startNodes.map(n => n.id).join(', ')}`);

  const exitNodes = allNodes.filter(n => n.attrs.handler === 'exit');
  if (exitNodes.length === 0) errors.push('No exit node found. Add a node with handler="exit".');
  if (exitNodes.length > 1)  errors.push(`Multiple exit nodes: ${exitNodes.map(n => n.id).join(', ')}`);

  // All nodes reachable from start
  if (startNodes.length === 1) {
    const reachable = new Set();
    const dfs = (id) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      allEdges.filter(e => e.from === id).forEach(e => dfs(e.to));
    };
    dfs(startNodes[0].id);

    for (const node of allNodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`Node '${node.id}' is not reachable from start.`);
      }
    }
  }

  // Edge targets must reference defined nodes
  const nodeIds = new Set(graph.nodes.keys());
  for (const edge of allEdges) {
    if (!nodeIds.has(edge.from)) errors.push(`Edge references undefined node '${edge.from}'`);
    if (!nodeIds.has(edge.to))   errors.push(`Edge references undefined node '${edge.to}'`);
  }

  // Condition syntax validation (must be a non-empty string if present)
  for (const edge of allEdges) {
    if (edge.attrs.condition !== undefined && typeof edge.attrs.condition !== 'string') {
      errors.push(`Edge ${edge.from} -> ${edge.to}: condition must be a string`);
    }
  }

  // ── Warnings (should fix) ────────────────────────────────────────────────

  for (const node of allNodes) {
    const h = node.attrs.handler;

    if (h === 'codergen' && !node.attrs.prompt) {
      warnings.push(`Node '${node.id}' (codergen) has no prompt attribute.`);
    }

    if (h === 'wait.human' && !node.attrs.question) {
      warnings.push(`Node '${node.id}' (wait.human) has no question attribute.`);
    }

    // Non-exit nodes with no outgoing edges
    if (h !== 'exit' && !allEdges.some(e => e.from === node.id)) {
      warnings.push(`Node '${node.id}' has no outgoing edges and is not an exit node.`);
    }
  }

  // Goal gates should have outgoing edges to retry targets
  for (const node of allNodes) {
    if (node.attrs.goal_gate === 'true') {
      const out = allEdges.filter(e => e.from === node.id);
      if (out.length === 0) {
        warnings.push(`Goal gate '${node.id}' has no retry edges — will fail hard if not satisfied.`);
      }
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}
