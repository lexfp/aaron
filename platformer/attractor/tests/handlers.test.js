import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HANDLERS } from '../src/pipeline/handlers.js';
import { PipelineContext } from '../src/pipeline/context.js';
import { NoopInterviewer } from '../src/pipeline/interviewer.js';

function node(id, handler, extras = {}) {
  return { id, attrs: { handler, ...extras } };
}

function svc(overrides = {}) {
  return {
    llmClient:    null,
    interviewer:  new NoopInterviewer('y'),
    executionEnv: {},
    profile:      { tools: [] },
    emit:         () => {},
    spawnSession: () => ({ run: async () => 'done' }),
    ...overrides,
  };
}

// ── start ────────────────────────────────────────────────────────────────────

describe('HANDLERS.start', () => {
  it('returns SUCCESS', async () => {
    const r = await HANDLERS.start(node('s', 'start'), new PipelineContext(), svc());
    assert.equal(r.status, 'SUCCESS');
  });
});

// ── exit ─────────────────────────────────────────────────────────────────────

describe('HANDLERS.exit', () => {
  it('returns SUCCESS', async () => {
    const r = await HANDLERS.exit(node('e', 'exit'), new PipelineContext(), svc());
    assert.equal(r.status, 'SUCCESS');
  });
});

// ── parallel ─────────────────────────────────────────────────────────────────

describe('HANDLERS.parallel', () => {
  it('returns SUCCESS (fan-out marker, no-op)', async () => {
    const r = await HANDLERS.parallel(node('p', 'parallel'), new PipelineContext(), svc());
    assert.equal(r.status, 'SUCCESS');
  });
});

// ── condition ────────────────────────────────────────────────────────────────

describe('HANDLERS.condition', () => {
  it('returns SUCCESS when expression is true', async () => {
    const ctx = new PipelineContext({ approved: true });
    const r = await HANDLERS.condition(node('c', 'condition', { condition: 'approved == true' }), ctx, svc());
    assert.equal(r.status, 'SUCCESS');
  });

  it('returns FAILURE when expression is false', async () => {
    const ctx = new PipelineContext({ approved: false });
    const r = await HANDLERS.condition(node('c', 'condition', { condition: 'approved == true' }), ctx, svc());
    assert.equal(r.status, 'FAILURE');
  });

  it('defaults to SUCCESS when no condition attribute is set', async () => {
    const r = await HANDLERS.condition(node('c', 'condition'), new PipelineContext(), svc());
    assert.equal(r.status, 'SUCCESS');
  });

  it('evaluates numeric comparison', async () => {
    const ctx = new PipelineContext({ n: 10 });
    const r = await HANDLERS.condition(node('c', 'condition', { condition: 'n > 5' }), ctx, svc());
    assert.equal(r.status, 'SUCCESS');
  });
});

// ── wait.human ───────────────────────────────────────────────────────────────

describe('HANDLERS["wait.human"]', () => {
  it('"y" response → SUCCESS and approved=true', async () => {
    const ctx = new PipelineContext();
    const r = await HANDLERS['wait.human'](node('h', 'wait.human', { question: 'Go?' }), ctx, svc({ interviewer: new NoopInterviewer('y') }));
    assert.equal(r.status, 'SUCCESS');
    assert.equal(ctx.get('h_approved'), true);
  });

  it('"n" response → FAILURE and approved=false', async () => {
    const ctx = new PipelineContext();
    const r = await HANDLERS['wait.human'](node('h', 'wait.human', { question: 'Go?' }), ctx, svc({ interviewer: new NoopInterviewer('n') }));
    assert.equal(r.status, 'FAILURE');
    assert.equal(ctx.get('h_approved'), false);
  });

  it('stores raw answer as nodeId_answer in context', async () => {
    const ctx = new PipelineContext();
    await HANDLERS['wait.human'](node('h', 'wait.human', { question: 'Go?' }), ctx, svc({ interviewer: new NoopInterviewer('yes') }));
    assert.equal(ctx.get('h_answer'), 'yes');
  });

  it('"yes", "approve", "ok", "1", "true" all count as approved', async () => {
    for (const val of ['yes', 'approve', 'ok', '1', 'true']) {
      const ctx = new PipelineContext();
      const r = await HANDLERS['wait.human'](
        node('h', 'wait.human', { question: 'OK?' }),
        ctx,
        svc({ interviewer: new NoopInterviewer(val) }),
      );
      assert.equal(r.status, 'SUCCESS', `expected SUCCESS for "${val}"`);
      assert.equal(ctx.get('h_approved'), true, `expected approved=true for "${val}"`);
    }
  });

  it('"no", "n", "0", "false" all count as not approved', async () => {
    for (const val of ['no', 'n', '0', 'false']) {
      const ctx = new PipelineContext();
      const r = await HANDLERS['wait.human'](
        node('h', 'wait.human', { question: 'OK?' }),
        ctx,
        svc({ interviewer: new NoopInterviewer(val) }),
      );
      assert.equal(r.status, 'FAILURE', `expected FAILURE for "${val}"`);
    }
  });

  it('interpolates {{context_var}} in the question string', async () => {
    const ctx = new PipelineContext({ prev_output: 'analysis result' });
    let capturedQuestion = '';
    const interviewer = { ask: async (q) => { capturedQuestion = q; return 'y'; } };
    await HANDLERS['wait.human'](node('h', 'wait.human', { question: 'Approve {{prev_output}}?' }), ctx, svc({ interviewer }));
    assert.ok(capturedQuestion.includes('analysis result'));
  });

  it('uses default question text when no question attr', async () => {
    const ctx = new PipelineContext();
    let q = '';
    const interviewer = { ask: async (question) => { q = question; return 'y'; } };
    await HANDLERS['wait.human'](node('h', 'wait.human'), ctx, svc({ interviewer }));
    assert.ok(typeof q === 'string' && q.length > 0);
  });
});

// ── codergen ─────────────────────────────────────────────────────────────────

describe('HANDLERS.codergen', () => {
  it('returns SUCCESS and stores nodeId_output in context', async () => {
    const ctx = new PipelineContext();
    const r = await HANDLERS.codergen(
      node('t', 'codergen', { prompt: 'Do the thing' }),
      ctx,
      svc({ spawnSession: () => ({ run: async () => 'task done' }) }),
    );
    assert.equal(r.status, 'SUCCESS');
    assert.equal(ctx.get('t_output'), 'task done');
  });

  it('passes the prompt to session.run', async () => {
    let capturedPrompt = '';
    const ctx = new PipelineContext();
    await HANDLERS.codergen(
      node('t', 'codergen', { prompt: 'My specific prompt' }),
      ctx,
      svc({ spawnSession: () => ({ run: async (p) => { capturedPrompt = p; return 'ok'; } }) }),
    );
    assert.equal(capturedPrompt, 'My specific prompt');
  });

  it('interpolates {{var}} in the prompt from context', async () => {
    const ctx = new PipelineContext({ prev_output: 'some data' });
    let capturedPrompt = '';
    await HANDLERS.codergen(
      node('t', 'codergen', { prompt: 'Based on {{prev_output}} do work' }),
      ctx,
      svc({ spawnSession: () => ({ run: async (p) => { capturedPrompt = p; return 'ok'; } }) }),
    );
    assert.ok(capturedPrompt.includes('some data'));
    assert.ok(!capturedPrompt.includes('{{prev_output}}'));
  });

  it('returns FAILURE and stores nodeId_error when session throws', async () => {
    const ctx = new PipelineContext();
    const r = await HANDLERS.codergen(
      node('t', 'codergen', { prompt: 'Work' }),
      ctx,
      svc({ spawnSession: () => ({ run: async () => { throw new Error('LLM unavailable'); } }) }),
    );
    assert.equal(r.status, 'FAILURE');
    assert.equal(ctx.get('t_error'), 'LLM unavailable');
  });

  it('uses a default prompt when no prompt attribute is set', async () => {
    let capturedPrompt = '';
    const ctx = new PipelineContext();
    await HANDLERS.codergen(
      node('t', 'codergen'),
      ctx,
      svc({ spawnSession: () => ({ run: async (p) => { capturedPrompt = p; return 'ok'; } }) }),
    );
    assert.ok(typeof capturedPrompt === 'string' && capturedPrompt.length > 0);
  });

  it('calls spawnSession with the model attribute if provided', async () => {
    let spawnOpts = null;
    const ctx = new PipelineContext();
    await HANDLERS.codergen(
      node('t', 'codergen', { prompt: 'hi', model: 'claude-opus-4-7' }),
      ctx,
      svc({ spawnSession: (opts) => { spawnOpts = opts; return { run: async () => 'ok' }; } }),
    );
    assert.equal(spawnOpts?.model, 'claude-opus-4-7');
  });
});

// ── manager ──────────────────────────────────────────────────────────────────

describe('HANDLERS.manager', () => {
  it('returns SUCCESS when the first codergen attempt succeeds', async () => {
    const ctx = new PipelineContext();
    const r = await HANDLERS.manager(
      node('m', 'manager', { prompt: 'Manage', max_iterations: '3' }),
      ctx,
      svc({ spawnSession: () => ({ run: async () => 'done' }) }),
    );
    assert.equal(r.status, 'SUCCESS');
  });

  it('retries up to max_iterations when each attempt fails, then returns FAILURE', async () => {
    const ctx = new PipelineContext();
    let calls = 0;
    const r = await HANDLERS.manager(
      node('m', 'manager', { prompt: 'Manage', max_iterations: '3' }),
      ctx,
      svc({ spawnSession: () => ({ run: async () => { calls++; throw new Error('fail'); } }) }),
    );
    assert.equal(r.status, 'FAILURE');
    assert.equal(calls, 3);
  });

  it('stops early on SUCCESS without exhausting max_iterations', async () => {
    const ctx = new PipelineContext();
    let calls = 0;
    await HANDLERS.manager(
      node('m', 'manager', { prompt: 'Manage', max_iterations: '5' }),
      ctx,
      svc({ spawnSession: () => ({ run: async () => { calls++; return 'done'; } }) }),
    );
    assert.equal(calls, 1);
  });

  it('defaults to max_iterations=5 when not specified', async () => {
    const ctx = new PipelineContext();
    let calls = 0;
    const r = await HANDLERS.manager(
      node('m', 'manager', { prompt: 'hi' }),
      ctx,
      svc({ spawnSession: () => ({ run: async () => { calls++; throw new Error('fail'); } }) }),
    );
    assert.equal(r.status, 'FAILURE');
    assert.equal(calls, 5);
  });
});
