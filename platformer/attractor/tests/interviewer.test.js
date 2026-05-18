import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NoopInterviewer, CLIInterviewer } from '../src/pipeline/interviewer.js';

describe('NoopInterviewer', () => {
  it('returns "y" by default when constructed with no args', async () => {
    const noop = new NoopInterviewer();
    const result = await noop.ask('Continue?');
    assert.equal(result, 'y');
  });

  it('returns custom default set in constructor', async () => {
    const noop = new NoopInterviewer('n');
    const result = await noop.ask('Continue?');
    assert.equal(result, 'n');
  });

  it('options.default overrides the constructor default', async () => {
    const noop = new NoopInterviewer('n');
    const result = await noop.ask('Continue?', { default: 'yes' });
    assert.equal(result, 'yes');
  });

  it('coerces a numeric options.default to a string', async () => {
    const noop = new NoopInterviewer();
    const result = await noop.ask('Count?', { default: 42 });
    assert.equal(typeof result, 'string');
    assert.equal(result, '42');
  });

  it('coerces a boolean options.default to a string', async () => {
    const noop = new NoopInterviewer();
    const result = await noop.ask('Bool?', { default: true });
    assert.equal(result, 'true');
  });

  it('accepts a timeout option without throwing', async () => {
    const noop = new NoopInterviewer();
    await assert.doesNotReject(() => noop.ask('OK?', { timeout: 5000, default: 'y' }));
  });

  it('always returns a string', async () => {
    const noop = new NoopInterviewer('yes');
    const result = await noop.ask('Question?');
    assert.equal(typeof result, 'string');
  });
});

describe('CLIInterviewer', () => {
  it('can be imported and instantiated', () => {
    const cli = new CLIInterviewer();
    assert.ok(cli instanceof CLIInterviewer);
  });

  it('has an ask method', () => {
    const cli = new CLIInterviewer();
    assert.equal(typeof cli.ask, 'function');
  });
});
