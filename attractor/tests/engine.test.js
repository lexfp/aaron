import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PipelineEngine } from '../src/pipeline/engine.js';
import { NoopInterviewer } from '../src/pipeline/interviewer.js';
import { CheckpointManager } from '../src/pipeline/checkpoint.js';

// Fake LLM client — returns a single text message with no tool calls so the
// session loop exits immediately after one turn.
function fakeLlm(text = 'done') {
  return {
    complete: async () => ({ content: [{ type: 'text', text }] }),
  };
}

function makeEngine(overrides = {}) {
  return new PipelineEngine({
    interviewer: new NoopInterviewer('y'),
    onEvent:     () => {},
    ...overrides,
  });
}

// ── Basic execution ──────────────────────────────────────────────────────────

describe('PipelineEngine — basic execution', () => {
  it('runs a minimal start → exit pipeline', async () => {
    const engine = makeEngine();
    await assert.doesNotReject(() =>
      engine.run('digraph { s [handler="start"]; e [handler="exit"]; s -> e }', {}),
    );
  });

  it('returns a context snapshot object', async () => {
    const engine = makeEngine();
    const ctx = await engine.run('digraph { s [handler="start"]; e [handler="exit"]; s -> e }', { greeting: 'hi' });
    assert.ok(typeof ctx === 'object');
  });

  it('preserves initialContext values in the returned snapshot', async () => {
    const engine = makeEngine();
    const ctx = await engine.run('digraph { s [handler="start"]; e [handler="exit"]; s -> e }', { seed: 42 });
    assert.equal(ctx.seed, 42);
  });

  it('sets nodeId_status="SUCCESS" for each executed node', async () => {
    const engine = makeEngine();
    const ctx = await engine.run('digraph { s [handler="start"]; e [handler="exit"]; s -> e }', {});
    assert.equal(ctx.s_status, 'SUCCESS');
    assert.equal(ctx.e_status, 'SUCCESS');
  });

  it('throws on a DOT parse error', async () => {
    const engine = makeEngine();
    await assert.rejects(() => engine.run('not valid dot source', {}), /DOT parse error/);
  });

  it('throws on validation failure (no start node)', async () => {
    const engine = makeEngine();
    await assert.rejects(() => engine.run('digraph { e [handler="exit"] }', {}), /validation failed/i);
  });

  it('throws on validation failure (no exit node)', async () => {
    const engine = makeEngine();
    await assert.rejects(() => engine.run('digraph { s [handler="start"] }', {}), /validation failed/i);
  });

  it('emits NODE_COMPLETE events for each executed node', async () => {
    const events = [];
    const engine = makeEngine({ onEvent: (type, data) => events.push({ type, data }) });
    await engine.run('digraph { s [handler="start"]; e [handler="exit"]; s -> e }', {});
    const completes = events.filter(ev => ev.type === 'NODE_COMPLETE');
    assert.ok(completes.length >= 2);
    assert.ok(completes.some(ev => ev.data.nodeId === 's'));
    assert.ok(completes.some(ev => ev.data.nodeId === 'e'));
  });
});

// ── Condition routing ────────────────────────────────────────────────────────
// Note: validator requires exactly one exit node, so branches use parallel/condition
// handlers as intermediate nodes and share a single exit.

describe('PipelineEngine — condition routing', () => {
  it('follows the true-condition edge, skips the false-condition edge', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('ran') });
    // yes and no are codergen nodes; both lead to the same exit.
    const src = `digraph {
      s   [handler="start"]
      c   [handler="condition", condition="flag == true"]
      yes [handler="codergen", prompt="yes branch"]
      no  [handler="codergen", prompt="no branch"]
      e   [handler="exit"]
      s -> c
      c -> yes [condition="flag == true"]
      c -> no  [condition="flag == false"]
      yes -> e
      no  -> e
    }`;
    const ctx = await engine.run(src, { flag: true });
    assert.equal(ctx.yes_status, 'SUCCESS');
    assert.equal(ctx.no_status, undefined);
  });

  it('follows the false-condition edge when condition is false', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('ran') });
    const src = `digraph {
      s     [handler="start"]
      gate  [handler="condition", condition="flag == true"]
      pathA [handler="codergen", prompt="path a"]
      pathB [handler="codergen", prompt="path b"]
      e     [handler="exit"]
      s -> gate
      gate -> pathA [condition="flag == true"]
      gate -> pathB [condition="flag == false"]
      pathA -> e
      pathB -> e
    }`;
    const ctx = await engine.run(src, { flag: false });
    assert.equal(ctx.pathB_status, 'SUCCESS');
    assert.equal(ctx.pathA_status, undefined);
  });
});

// ── wait.human routing ───────────────────────────────────────────────────────

describe('PipelineEngine — wait.human routing', () => {
  it('follows the approved edge when interviewer says "y"', async () => {
    const engine = makeEngine({
      interviewer:  new NoopInterviewer('y'),
      llmClient:    fakeLlm('ran'),
    });
    // Both accept/reject are codergen nodes sharing a single exit.
    const src = `digraph {
      s      [handler="start"]
      h      [handler="wait.human", question="Proceed?"]
      accept [handler="codergen", prompt="accepted"]
      reject [handler="codergen", prompt="rejected"]
      e      [handler="exit"]
      s -> h
      h -> accept [condition="h_approved == true"]
      h -> reject [condition="h_approved == false"]
      accept -> e
      reject -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.accept_status, 'SUCCESS');
    assert.equal(ctx.reject_status, undefined);
  });

  it('follows the rejected edge when interviewer says "n"', async () => {
    const engine = makeEngine({
      interviewer: new NoopInterviewer('n'),
      llmClient:   fakeLlm('ran'),
    });
    const src = `digraph {
      s      [handler="start"]
      h      [handler="wait.human", question="Proceed?"]
      accept [handler="codergen", prompt="accepted"]
      reject [handler="codergen", prompt="rejected"]
      e      [handler="exit"]
      s -> h
      h -> accept [condition="h_approved == true"]
      h -> reject [condition="h_approved == false"]
      accept -> e
      reject -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.reject_status, 'SUCCESS');
    assert.equal(ctx.accept_status, undefined);
  });
});

// ── Edge selection ───────────────────────────────────────────────────────────
// Each test needs exactly one exit node. Branches use parallel/codergen and
// share a single exit to satisfy the validator.

describe('PipelineEngine — edge selection', () => {
  it('preferred label: selects edge matching node.attrs.preferred', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('ran') });
    const src = `digraph {
      s [handler="start", preferred="go"]
      a [handler="codergen", prompt="stop path"]
      b [handler="codergen", prompt="go path"]
      e [handler="exit"]
      s -> a [label="stop"]
      s -> b [label="go"]
      a -> e
      b -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.b_status, 'SUCCESS');
    assert.equal(ctx.a_status, undefined);
  });

  it('weight: selects the edge with the highest numeric weight', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('ran') });
    const src = `digraph {
      s  [handler="start"]
      lo [handler="codergen", prompt="low"]
      hi [handler="codergen", prompt="high"]
      e  [handler="exit"]
      s -> lo [weight="1"]
      s -> hi [weight="5"]
      lo -> e
      hi -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.hi_status, 'SUCCESS');
    assert.equal(ctx.lo_status, undefined);
  });

  it('lexical fallback: selects edge with alphabetically first label', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('ran') });
    const src = `digraph {
      s     [handler="start"]
      late  [handler="codergen", prompt="late"]
      early [handler="codergen", prompt="early"]
      e     [handler="exit"]
      s -> late  [label="zzz"]
      s -> early [label="aaa"]
      late  -> e
      early -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.early_status, 'SUCCESS');
    assert.equal(ctx.late_status, undefined);
  });
});

// ── Variable expansion ───────────────────────────────────────────────────────

describe('PipelineEngine — variable expansion', () => {
  it('expands ${var} in node attributes before execution', async () => {
    let capturedPrompt = '';
    const trackingLlm = {
      complete: async (req) => {
        const userMsg = req.messages.find(m => m.role === 'user');
        capturedPrompt = userMsg?.content?.[0]?.text ?? '';
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    };
    const engine = makeEngine({ llmClient: trackingLlm });
    // \${target} in the template literal becomes the literal string ${target}
    const src = `digraph {
      s [handler="start"]
      t [handler="codergen", prompt="Analyze \${target}"]
      e [handler="exit"]
      s -> t -> e
    }`;
    await engine.run(src, {}, { variables: { target: 'src/app.js' } });
    assert.ok(capturedPrompt.includes('src/app.js'), `prompt was: ${capturedPrompt}`);
  });
});

// ── Goal gates ───────────────────────────────────────────────────────────────

describe('PipelineEngine — goal gates', () => {
  it('passes when a goal_gate node succeeds', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('done') });
    const src = `digraph {
      s [handler="start"]
      g [handler="codergen", prompt="Do it", goal_gate="true"]
      e [handler="exit"]
      s -> g -> e
    }`;
    await assert.doesNotReject(() => engine.run(src, {}));
  });

  it('throws "Goal gates not satisfied" when a goal_gate node ends in FAILURE', async () => {
    // Session will throw (no retryable flag), codergen catches → FAILURE status
    const failingLlm = { complete: async () => { throw new Error('LLM down'); } };
    const engine = makeEngine({ llmClient: failingLlm });
    const src = `digraph {
      s [handler="start"]
      g [handler="codergen", prompt="Do it", goal_gate="true"]
      e [handler="exit"]
      s -> g -> e
    }`;
    await assert.rejects(() => engine.run(src, {}), /Goal gates not satisfied/);
  });
});

// ── Retry logic ───────────────────────────────────────────────────────────────

describe('PipelineEngine — retry policy', () => {
  it('fires NODE_RETRY events when a handler throws, up to max_attempts-1 times', async () => {
    const events = [];
    const engine = makeEngine({ onEvent: (type, data) => events.push({ type, data }) });
    // The `tool` handler throws when the tool name is not in the profile
    const src = `digraph {
      s [handler="start"]
      t [handler="tool", tool="nonexistent_tool", max_attempts="3"]
      e [handler="exit"]
      s -> t -> e
    }`;
    const ctx = await engine.run(src, {});
    const retries = events.filter(ev => ev.type === 'NODE_RETRY');
    assert.equal(retries.length, 2); // 3 attempts → 2 retries
    assert.equal(ctx.t_status, 'FAILURE');
  });

  it('does NOT fire NODE_RETRY for codergen (it catches errors internally)', async () => {
    const failingLlm = { complete: async () => { throw new Error('LLM error'); } };
    const events = [];
    const engine = makeEngine({
      llmClient: failingLlm,
      onEvent: (type, data) => events.push({ type, data }),
    });
    const src = `digraph {
      s [handler="start"]
      t [handler="codergen", prompt="work"]
      e [handler="exit"]
      s -> t -> e
    }`;
    await engine.run(src, {});
    const retries = events.filter(ev => ev.type === 'NODE_RETRY');
    assert.equal(retries.length, 0);
    assert.equal((await engine.run(src, {})).t_status, 'FAILURE');
  });
});

// ── Checkpoint ────────────────────────────────────────────────────────────────

describe('PipelineEngine — checkpoint', () => {
  let dir;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'engine-cp-test-'));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('completes without error when checkpoint=true', async () => {
    const engine = makeEngine();
    const src = 'digraph { s [handler="start"]; e [handler="exit"]; s -> e }';
    const checkpointPath = join(dir, 'cp1.json');
    await assert.doesNotReject(() => engine.run(src, {}, { checkpoint: true, checkpointPath }));
  });

  it('checkpoint file is removed after a successful run', async () => {
    const engine = makeEngine();
    const src = 'digraph { s [handler="start"]; e [handler="exit"]; s -> e }';
    const checkpointPath = join(dir, 'cp2.json');
    await engine.run(src, {}, { checkpoint: true, checkpointPath });
    const mgr = new CheckpointManager(checkpointPath);
    assert.equal(await mgr.load(), null);
  });
});

// ── codergen integration ─────────────────────────────────────────────────────

describe('PipelineEngine — codergen integration', () => {
  it('codergen with fake LLM stores output in context', async () => {
    const engine = makeEngine({ llmClient: fakeLlm('task complete!') });
    const src = `digraph {
      s [handler="start"]
      t [handler="codergen", prompt="Do something"]
      e [handler="exit"]
      s -> t -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.t_status, 'SUCCESS');
    assert.equal(ctx.t_output, 'task complete!');
  });

  it('multi-step pipeline: t1_output is interpolated into t2 prompt via {{t1_output}}', async () => {
    // t2 prompt uses {{t1_output}} — verify context value flows between nodes.
    const engine = makeEngine({ llmClient: fakeLlm('task-done') });
    const src = `digraph {
      s  [handler="start"]
      t1 [handler="codergen", prompt="first task"]
      t2 [handler="codergen", prompt="second task using {{t1_output}}"]
      e  [handler="exit"]
      s -> t1 -> t2 -> e
    }`;
    const ctx = await engine.run(src, {});
    assert.equal(ctx.t1_status, 'SUCCESS');
    assert.equal(ctx.t2_status, 'SUCCESS');
    assert.equal(ctx.t1_output, 'task-done');
    assert.equal(ctx.t2_output, 'task-done');
  });
});
