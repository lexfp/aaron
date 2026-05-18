import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDot } from '../src/pipeline/dot-parser.js';
import { validate } from '../src/pipeline/validator.js';

function g(src) { return parseDot(src); }

describe('validate', () => {
  // ── Valid pipelines ──────────────────────────────────────────────────────────

  it('valid minimal pipeline passes', () => {
    const r = validate(g('digraph { s [handler="start"]; e [handler="exit"]; s -> e }'));
    assert.ok(r.valid);
    assert.equal(r.errors.length, 0);
  });

  it('returns valid=true and empty warnings for a clean pipeline', () => {
    const r = validate(g(`digraph {
      s [handler="start"]
      t [handler="codergen", prompt="hi"]
      e [handler="exit"]
      s -> t
      t -> e
    }`));
    assert.ok(r.valid);
    assert.equal(r.warnings.length, 0);
  });

  // ── Errors ───────────────────────────────────────────────────────────────────

  it('no start node is an error', () => {
    const r = validate(g('digraph { e [handler="exit"] }'));
    assert.ok(!r.valid);
    assert.ok(r.errors.some(e => /start/i.test(e)));
  });

  it('no exit node is an error', () => {
    const r = validate(g('digraph { s [handler="start"] }'));
    assert.ok(!r.valid);
    assert.ok(r.errors.some(e => /exit/i.test(e)));
  });

  it('multiple start nodes is an error', () => {
    const r = validate(g('digraph { s1 [handler="start"]; s2 [handler="start"]; e [handler="exit"]; s1 -> e; s2 -> e }'));
    assert.ok(!r.valid);
    assert.ok(r.errors.some(e => /Multiple start/i.test(e)));
  });

  it('multiple exit nodes is an error', () => {
    const r = validate(g('digraph { s [handler="start"]; e1 [handler="exit"]; e2 [handler="exit"]; s -> e1; s -> e2 }'));
    assert.ok(!r.valid);
    assert.ok(r.errors.some(e => /Multiple exit/i.test(e)));
  });

  it('edge referencing undefined target node is an error', () => {
    const r = validate(g('digraph { s [handler="start"]; e [handler="exit"]; s -> ghost }'));
    assert.ok(!r.valid);
    assert.ok(r.errors.some(e => e.includes('ghost')));
  });

  it('edge referencing undefined source node is an error', () => {
    const r = validate(g('digraph { s [handler="start"]; e [handler="exit"]; ghost -> e }'));
    assert.ok(!r.valid);
    assert.ok(r.errors.some(e => e.includes('ghost')));
  });

  it('valid=false when errors are present', () => {
    const r = validate(g('digraph { e [handler="exit"] }'));
    assert.equal(r.valid, false);
  });

  // ── Warnings ─────────────────────────────────────────────────────────────────

  it('unreachable node produces a warning, not an error', () => {
    const r = validate(g(`digraph {
      s [handler="start"]
      e [handler="exit"]
      orphan [handler="codergen", prompt="hi"]
      s -> e
    }`));
    assert.ok(r.valid);
    assert.ok(r.warnings.some(w => w.includes('orphan')));
  });

  it('codergen without prompt attribute produces a warning', () => {
    const r = validate(g('digraph { s [handler="start"]; t [handler="codergen"]; e [handler="exit"]; s -> t; t -> e }'));
    assert.ok(r.valid);
    assert.ok(r.warnings.some(w => /no prompt/i.test(w)));
  });

  it('wait.human without question attribute produces a warning', () => {
    const r = validate(g('digraph { s [handler="start"]; h [handler="wait.human"]; e [handler="exit"]; s -> h; h -> e }'));
    assert.ok(r.valid);
    assert.ok(r.warnings.some(w => /no question/i.test(w)));
  });

  it('non-exit node with no outgoing edges produces a warning', () => {
    const r = validate(g(`digraph {
      s [handler="start"]
      t [handler="codergen", prompt="hi"]
      e [handler="exit"]
      s -> t
    }`));
    // t has no outgoing edge
    assert.ok(r.warnings.some(w => w.includes("'t'") && /no outgoing/i.test(w)));
    // exit node (e) should NOT produce a warning since it's an exit handler
    assert.ok(!r.warnings.some(w => w.includes("'e'") && /no outgoing/i.test(w)));
  });

  it('exit node with no outgoing edges does NOT produce a warning', () => {
    const r = validate(g('digraph { s [handler="start"]; e [handler="exit"]; s -> e }'));
    assert.ok(!r.warnings.some(w => w.includes("'e'") && /no outgoing/i.test(w)));
  });

  it('goal gate node with outgoing edges does NOT warn', () => {
    const r = validate(g(`digraph {
      s [handler="start"]
      g [handler="codergen", prompt="hi", goal_gate="true"]
      e [handler="exit"]
      s -> g
      g -> e
    }`));
    // g has outgoing edge, so no "no retry edges" warning
    assert.ok(!r.warnings.some(w => /Goal gate.*no retry/i.test(w)));
  });

  it('goal gate node with no outgoing edges warns', () => {
    // Manually build a graph since the parser would auto-create the node without edges
    const graph = {
      nodes: new Map([
        ['s', { id: 's', attrs: { handler: 'start' } }],
        ['g', { id: 'g', attrs: { handler: 'codergen', prompt: 'hi', goal_gate: 'true' } }],
        ['e', { id: 'e', attrs: { handler: 'exit' } }],
      ]),
      edges: [
        { from: 's', to: 'g', attrs: {} },
        { from: 's', to: 'e', attrs: {} },
        // no edge from g
      ],
    };
    const r = validate(graph);
    assert.ok(r.warnings.some(w => w.includes("'g'") || /Goal gate.*no retry/i.test(w)));
  });

  // ── Combined ─────────────────────────────────────────────────────────────────

  it('returns both errors and warnings simultaneously', () => {
    // Missing exit (error) + orphan node (warning)
    const r = validate(g(`digraph {
      s  [handler="start"]
      t  [handler="codergen", prompt="hi"]
      s -> t
    }`));
    assert.ok(!r.valid);
    assert.ok(r.errors.length > 0);
    assert.ok(r.warnings.length > 0);
  });

  it('validate result always has errors and warnings arrays', () => {
    const r = validate(g('digraph { s [handler="start"]; e [handler="exit"]; s -> e }'));
    assert.ok(Array.isArray(r.errors));
    assert.ok(Array.isArray(r.warnings));
  });
});
