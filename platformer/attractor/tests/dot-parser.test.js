import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDot } from '../src/pipeline/dot-parser.js';

describe('parseDot', () => {
  // ── Basic structure ──────────────────────────────────────────────────────────

  it('parses empty digraph', () => {
    const g = parseDot('digraph {}');
    assert.equal(g.nodes.size, 0);
    assert.equal(g.edges.length, 0);
  });

  it('parses graph keyword', () => {
    const g = parseDot('graph {}');
    assert.equal(g.nodes.size, 0);
    assert.equal(g.edges.length, 0);
  });

  it('parses strict digraph', () => {
    const g = parseDot('strict digraph {}');
    assert.equal(g.nodes.size, 0);
  });

  it('parses named digraph', () => {
    const g = parseDot('digraph myPipeline {}');
    assert.equal(g.nodes.size, 0);
  });

  it('parses quoted digraph name', () => {
    const g = parseDot('digraph "my pipeline" {}');
    assert.equal(g.nodes.size, 0);
  });

  it('throws SyntaxError on missing digraph/graph keyword', () => {
    assert.throws(() => parseDot('{ a -> b }'), /Expected 'digraph' or 'graph'/);
  });

  it('throws SyntaxError on completely invalid input', () => {
    assert.throws(() => parseDot('not valid at all'), /Expected 'digraph' or 'graph'/);
  });

  // ── Nodes ────────────────────────────────────────────────────────────────────

  it('parses a bare node with no attributes', () => {
    const g = parseDot('digraph { myNode }');
    assert.ok(g.nodes.has('myNode'));
    assert.deepEqual(g.nodes.get('myNode').attrs, {});
  });

  it('parses node with string attributes', () => {
    const g = parseDot('digraph { a [handler="start", label="Begin"] }');
    assert.equal(g.nodes.get('a').attrs.handler, 'start');
    assert.equal(g.nodes.get('a').attrs.label, 'Begin');
  });

  it('parses bare attribute (no = value) as "true"', () => {
    const g = parseDot('digraph { a [goal_gate] }');
    assert.equal(g.nodes.get('a').attrs.goal_gate, 'true');
  });

  it('merges duplicate node declarations', () => {
    const g = parseDot('digraph { a [handler="start"]; a [label="A"] }');
    assert.equal(g.nodes.get('a').attrs.handler, 'start');
    assert.equal(g.nodes.get('a').attrs.label, 'A');
  });

  it('node id is preserved on the node object', () => {
    const g = parseDot('digraph { mynode [handler="exit"] }');
    assert.equal(g.nodes.get('mynode').id, 'mynode');
  });

  // ── Edges ────────────────────────────────────────────────────────────────────

  it('parses a simple edge', () => {
    const g = parseDot('digraph { a -> b }');
    assert.equal(g.edges.length, 1);
    assert.equal(g.edges[0].from, 'a');
    assert.equal(g.edges[0].to, 'b');
    assert.deepEqual(g.edges[0].attrs, {});
  });

  it('parses edge with attributes', () => {
    const g = parseDot('digraph { a -> b [label="ok", weight="2"] }');
    assert.equal(g.edges[0].attrs.label, 'ok');
    assert.equal(g.edges[0].attrs.weight, '2');
  });

  it('parses chained edges a -> b -> c', () => {
    const g = parseDot('digraph { a -> b -> c }');
    assert.equal(g.edges.length, 2);
    assert.equal(g.edges[0].from, 'a');
    assert.equal(g.edges[0].to, 'b');
    assert.equal(g.edges[1].from, 'b');
    assert.equal(g.edges[1].to, 'c');
  });

  it('parses multiple edges from same source node', () => {
    const g = parseDot('digraph { a -> b; a -> c; a -> d }');
    assert.equal(g.edges.length, 3);
    assert.ok(g.edges.every(e => e.from === 'a'));
  });

  it('parses condition attr with spaces in value', () => {
    const g = parseDot('digraph { a -> b [condition="approved == true"] }');
    assert.equal(g.edges[0].attrs.condition, 'approved == true');
  });

  // ── Comments ─────────────────────────────────────────────────────────────────

  it('ignores line comments', () => {
    const g = parseDot('digraph {\n  // this is a comment\n  a -> b\n}');
    assert.equal(g.edges.length, 1);
  });

  it('ignores block comments', () => {
    const g = parseDot('digraph { /* block comment */ a -> b }');
    assert.equal(g.edges.length, 1);
  });

  it('ignores multi-line block comments', () => {
    const g = parseDot('digraph {\n  /* line1\n     line2 */\n  a -> b\n}');
    assert.equal(g.edges.length, 1);
  });

  // ── Quoted strings ───────────────────────────────────────────────────────────

  it('parses quoted node IDs', () => {
    const g = parseDot('digraph { "my node" -> "other node" }');
    assert.equal(g.edges[0].from, 'my node');
    assert.equal(g.edges[0].to, 'other node');
  });

  it('handles backslash escape sequences in quoted strings (strips backslash, keeps next char)', () => {
    // The parser strips the backslash and keeps the following character literally.
    // So "line1\nline2" in DOT → 'line1nline2' (not a real newline).
    const g = parseDot('digraph { a [label="line1\\nline2"] }');
    assert.equal(g.nodes.get('a').attrs.label, 'line1nline2');
  });

  // ── Subgraphs ────────────────────────────────────────────────────────────────

  it('extracts nodes from a named subgraph', () => {
    const g = parseDot('digraph { subgraph cluster_A { a [handler="start"] } }');
    assert.ok(g.nodes.has('a'));
    assert.equal(g.nodes.get('a').attrs.handler, 'start');
  });

  it('extracts edges from a subgraph', () => {
    const g = parseDot('digraph { subgraph cluster_A { a -> b } }');
    assert.equal(g.edges.length, 1);
    assert.equal(g.edges[0].from, 'a');
  });

  // ── Default attribute blocks ─────────────────────────────────────────────────

  it('skips graph/node/edge default attribute blocks', () => {
    const g = parseDot('digraph { graph [rankdir="LR"]; node [shape="box"]; edge [color="red"]; a -> b }');
    assert.equal(g.edges.length, 1);
  });

  // ── Semicolons ───────────────────────────────────────────────────────────────

  it('handles semicolons as statement separators', () => {
    const g = parseDot('digraph { a; b; a -> b; }');
    assert.ok(g.nodes.has('a'));
    assert.ok(g.nodes.has('b'));
    assert.equal(g.edges.length, 1);
  });

  // ── Full pipeline ────────────────────────────────────────────────────────────

  it('parses a complete 3-node pipeline', () => {
    const src = `
      digraph pipeline {
        start  [handler="start"]
        task   [handler="codergen", prompt="Do the thing", fidelity="full"]
        done   [handler="exit"]
        start -> task
        task  -> done [label="complete"]
      }
    `;
    const g = parseDot(src);
    assert.equal(g.nodes.size, 3);
    assert.equal(g.edges.length, 2);
    assert.equal(g.nodes.get('task').attrs.prompt, 'Do the thing');
    assert.equal(g.nodes.get('task').attrs.fidelity, 'full');
    assert.equal(g.edges[1].attrs.label, 'complete');
  });

  it('parses pipeline with condition edges and goal_gate', () => {
    const src = `
      digraph {
        s [handler="start"]
        g [handler="codergen", prompt="work", goal_gate="true"]
        h [handler="wait.human", question="OK?"]
        e [handler="exit"]
        s -> g
        g -> h
        h -> e  [condition="h_approved == true"]
        h -> g  [condition="h_approved == false"]
      }
    `;
    const g = parseDot(src);
    assert.equal(g.nodes.size, 4);
    assert.equal(g.edges.length, 4);
    assert.equal(g.nodes.get('g').attrs.goal_gate, 'true');
    const condEdges = g.edges.filter(e => e.attrs.condition);
    assert.equal(condEdges.length, 2);
  });
});
