import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PipelineContext } from '../src/pipeline/context.js';

describe('PipelineContext', () => {
  // ── Constructor ──────────────────────────────────────────────────────────────

  it('initializes with an empty store when no args given', () => {
    const ctx = new PipelineContext();
    assert.equal(ctx.get('anything'), undefined);
  });

  it('initializes with provided key-value pairs', () => {
    const ctx = new PipelineContext({ foo: 'bar', count: 3 });
    assert.equal(ctx.get('foo'), 'bar');
    assert.equal(ctx.get('count'), 3);
  });

  it('initial data is copied (not aliased)', () => {
    const data = { x: 1 };
    const ctx = new PipelineContext(data);
    data.x = 999;
    assert.equal(ctx.get('x'), 1);
  });

  // ── get / set ────────────────────────────────────────────────────────────────

  it('set and get round-trip a string value', () => {
    const ctx = new PipelineContext();
    ctx.set('key', 'hello');
    assert.equal(ctx.get('key'), 'hello');
  });

  it('set and get round-trip a number value', () => {
    const ctx = new PipelineContext();
    ctx.set('n', 42);
    assert.equal(ctx.get('n'), 42);
  });

  it('set and get round-trip a boolean value', () => {
    const ctx = new PipelineContext();
    ctx.set('flag', false);
    assert.equal(ctx.get('flag'), false);
  });

  it('set and get round-trip an object value', () => {
    const ctx = new PipelineContext();
    ctx.set('obj', { a: 1 });
    assert.deepEqual(ctx.get('obj'), { a: 1 });
  });

  it('overwriting a key replaces its value', () => {
    const ctx = new PipelineContext({ x: 1 });
    ctx.set('x', 2);
    assert.equal(ctx.get('x'), 2);
  });

  // ── has / delete ─────────────────────────────────────────────────────────────

  it('has returns true for an existing key', () => {
    const ctx = new PipelineContext({ x: 1 });
    assert.ok(ctx.has('x'));
  });

  it('has returns false for a missing key', () => {
    const ctx = new PipelineContext();
    assert.ok(!ctx.has('missing'));
  });

  it('delete removes the key', () => {
    const ctx = new PipelineContext({ x: 1 });
    ctx.delete('x');
    assert.ok(!ctx.has('x'));
    assert.equal(ctx.get('x'), undefined);
  });

  it('delete on non-existent key does not throw', () => {
    const ctx = new PipelineContext();
    assert.doesNotThrow(() => ctx.delete('nope'));
  });

  // ── merge ────────────────────────────────────────────────────────────────────

  it('merge adds new keys', () => {
    const ctx = new PipelineContext({ a: 1 });
    ctx.merge({ b: 2, c: 3 });
    assert.equal(ctx.get('b'), 2);
    assert.equal(ctx.get('c'), 3);
  });

  it('merge preserves existing keys not in the merged object', () => {
    const ctx = new PipelineContext({ a: 1 });
    ctx.merge({ b: 2 });
    assert.equal(ctx.get('a'), 1);
  });

  it('merge overwrites existing keys', () => {
    const ctx = new PipelineContext({ a: 1 });
    ctx.merge({ a: 99 });
    assert.equal(ctx.get('a'), 99);
  });

  // ── snapshot / restore ───────────────────────────────────────────────────────

  it('snapshot returns a plain object with all stored keys', () => {
    const ctx = new PipelineContext({ x: 42, y: 'hi' });
    const snap = ctx.snapshot();
    assert.deepEqual(snap, { x: 42, y: 'hi' });
  });

  it('snapshot is a shallow copy — mutations do not affect the context', () => {
    const ctx = new PipelineContext({ x: 42 });
    const snap = ctx.snapshot();
    snap.x = 999;
    assert.equal(ctx.get('x'), 42);
  });

  it('restore replaces the entire store', () => {
    const ctx = new PipelineContext({ x: 1 });
    ctx.restore({ y: 2, z: 3 });
    assert.ok(!ctx.has('x'));
    assert.equal(ctx.get('y'), 2);
    assert.equal(ctx.get('z'), 3);
  });

  it('restore with empty object clears the store', () => {
    const ctx = new PipelineContext({ x: 1 });
    ctx.restore({});
    assert.ok(!ctx.has('x'));
  });

  it('toJSON returns the same result as snapshot', () => {
    const ctx = new PipelineContext({ a: 1, b: 'hello' });
    assert.deepEqual(ctx.toJSON(), ctx.snapshot());
  });

  // ── evaluate ─────────────────────────────────────────────────────────────────

  describe('evaluate', () => {
    it('evaluates "true" literal as truthy', () => {
      assert.ok(new PipelineContext().evaluate('true'));
    });

    it('evaluates "false" literal as falsy', () => {
      assert.ok(!new PipelineContext().evaluate('false'));
    });

    it('evaluates empty string as truthy (treated as empty expression)', () => {
      assert.ok(new PipelineContext().evaluate(''));
    });

    it('evaluates context variable equality (approved == true)', () => {
      const ctx = new PipelineContext({ approved: true });
      assert.ok(ctx.evaluate('approved == true'));
    });

    it('evaluates context variable inequality', () => {
      const ctx = new PipelineContext({ approved: false });
      assert.ok(!ctx.evaluate('approved == true'));
    });

    it('evaluates numeric greater-than comparison', () => {
      const ctx = new PipelineContext({ count: 5 });
      assert.ok(ctx.evaluate('count > 3'));
      assert.ok(!ctx.evaluate('count > 10'));
    });

    it('evaluates strict string equality', () => {
      const ctx = new PipelineContext({ status: 'SUCCESS' });
      assert.ok(ctx.evaluate('status === "SUCCESS"'));
      assert.ok(!ctx.evaluate('status === "FAILURE"'));
    });

    it('returns false on a JavaScript syntax error', () => {
      assert.ok(!new PipelineContext().evaluate('!!! $$$ invalid'));
    });

    it('evaluates a complex AND expression', () => {
      const ctx = new PipelineContext({ a: 1, b: 2 });
      assert.ok(ctx.evaluate('a === 1 && b === 2'));
      assert.ok(!ctx.evaluate('a === 1 && b === 3'));
    });

    it('evaluates OR expression', () => {
      const ctx = new PipelineContext({ flag: false });
      assert.ok(ctx.evaluate('flag === true || 1 === 1'));
    });

    it('undefined variable evaluates without throwing', () => {
      const ctx = new PipelineContext();
      // missing_var is undefined; expression should evaluate safely
      assert.doesNotThrow(() => ctx.evaluate('missing_var === true'));
    });
  });
});
