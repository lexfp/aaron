import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointManager } from '../src/pipeline/checkpoint.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('CheckpointManager', () => {
  let dir;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'attractor-cp-test-'));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('uses ".attractor-checkpoint.json" as the default path', () => {
    const mgr = new CheckpointManager();
    assert.equal(mgr.path, '.attractor-checkpoint.json');
  });

  it('load returns null when no checkpoint file exists', async () => {
    const mgr = new CheckpointManager(join(dir, 'nonexistent.json'));
    const result = await mgr.load();
    assert.equal(result, null);
  });

  it('save writes JSON file to disk', async () => {
    const path = join(dir, 'test-save.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({
      context: { foo: 'bar' },
      completedNodes: ['start'],
      retryCounts: {},
      currentNode: 'start',
    });
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.context.foo, 'bar');
  });

  it('load deserializes context correctly', async () => {
    const path = join(dir, 'test-ctx.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({ context: { key: 'value', num: 42 }, completedNodes: [], retryCounts: {}, currentNode: 'x' });
    const loaded = await mgr.load();
    assert.deepEqual(loaded.context, { key: 'value', num: 42 });
  });

  it('load deserializes completedNodes correctly', async () => {
    const path = join(dir, 'test-nodes.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({ context: {}, completedNodes: ['start', 'taskA'], retryCounts: {}, currentNode: 'taskA' });
    const loaded = await mgr.load();
    assert.deepEqual(loaded.completedNodes, ['start', 'taskA']);
  });

  it('load deserializes retryCounts correctly', async () => {
    const path = join(dir, 'test-retry.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({ context: {}, completedNodes: [], retryCounts: { taskB: 2 }, currentNode: 'taskB' });
    const loaded = await mgr.load();
    assert.deepEqual(loaded.retryCounts, { taskB: 2 });
  });

  it('saved checkpoint includes a valid ISO 8601 savedAt timestamp', async () => {
    const path = join(dir, 'test-timestamp.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({ context: {}, completedNodes: [], retryCounts: {}, currentNode: 'x' });
    const loaded = await mgr.load();
    assert.ok(typeof loaded.savedAt === 'string');
    assert.ok(!isNaN(Date.parse(loaded.savedAt)));
  });

  it('save overwrites a previous checkpoint', async () => {
    const path = join(dir, 'test-overwrite.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({ context: { x: 1 }, completedNodes: ['start'], retryCounts: {}, currentNode: 'start' });
    await mgr.save({ context: { x: 99 }, completedNodes: ['start', 'task'], retryCounts: {}, currentNode: 'task' });
    const loaded = await mgr.load();
    assert.equal(loaded.context.x, 99);
    assert.equal(loaded.completedNodes.length, 2);
    assert.equal(loaded.currentNode, 'task');
  });

  it('clear removes the checkpoint file (load returns null afterwards)', async () => {
    const path = join(dir, 'test-clear.json');
    const mgr = new CheckpointManager(path);
    await mgr.save({ context: {}, completedNodes: [], retryCounts: {}, currentNode: 'x' });
    await mgr.clear();
    const loaded = await mgr.load();
    assert.equal(loaded, null);
  });

  it('clear succeeds even when no checkpoint file exists', async () => {
    const mgr = new CheckpointManager(join(dir, 'does-not-exist.json'));
    await assert.doesNotReject(() => mgr.clear());
  });
});
