#!/usr/bin/env node
// Attractor CLI — run a DOT pipeline from the command line.
// Usage: node attractor.js <pipeline.dot> [--var key=value ...] [--checkpoint] [--provider anthropic|openai|gemini]

import { readFile } from 'node:fs/promises';
import { resolve }  from 'node:path';
import { LLMClient }      from './src/llm/client.js';
import { PipelineEngine } from './src/pipeline/engine.js';
import { CLIInterviewer } from './src/pipeline/interviewer.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Attractor — DOT-based AI pipeline runner

Usage:
  node attractor.js <pipeline.dot> [options]

Options:
  --var key=value     Set a template variable (repeatable)
  --checkpoint        Enable checkpoint/resume support
  --provider <name>   Default provider: anthropic | openai | gemini
  --model <id>        Override model for codergen nodes
  --debug             Enable debug event logging
  --help              Show this help

Environment variables:
  ANTHROPIC_API_KEY   Anthropic API key
  OPENAI_API_KEY      OpenAI API key
  GEMINI_API_KEY      Google Gemini API key

Examples:
  node attractor.js examples/hello.dot
  node attractor.js examples/coding-task.dot --var target=src/app.js --checkpoint
`);
    process.exit(0);
  }

  const dotFile    = resolve(args[0]);
  const variables  = {};
  let   checkpoint = false;
  let   debug      = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--checkpoint') { checkpoint = true; continue; }
    if (args[i] === '--debug')      { debug = true; process.env.ATTRACTOR_DEBUG = '1'; continue; }
    if (args[i] === '--var' && args[i + 1]) {
      const [key, ...rest] = args[++i].split('=');
      variables[key] = rest.join('=');
      continue;
    }
  }

  let dotSource;
  try {
    dotSource = await readFile(dotFile, 'utf8');
  } catch (err) {
    console.error(`Cannot read pipeline file: ${dotFile}\n${err.message}`);
    process.exit(1);
  }

  const llmClient   = new LLMClient();
  const interviewer = new CLIInterviewer();

  const engine = new PipelineEngine({
    llmClient,
    interviewer,
    onEvent: (type, data) => {
      if (type === 'NODE_COMPLETE') {
        const status = data.status === 'SUCCESS' ? '✓' : '✗';
        console.log(`  [${status}] ${data.nodeId}`);
      } else if (type === 'NODE_RETRY') {
        console.log(`  [retry] ${data.nodeId} (attempt ${data.attempt}, delay ${Math.round(data.delay)}ms)`);
      } else if (type === 'VALIDATION_WARNING') {
        console.warn(`  [warn] ${data.message}`);
      } else if (type === 'CHECKPOINT_RESUMED') {
        console.log(`  [checkpoint] Resuming (${data.completedCount} nodes already done)`);
      } else if (type === 'PIPELINE_COMPLETE') {
        // handled below
      } else if (debug) {
        console.log(`  [${type}]`, JSON.stringify(data).slice(0, 200));
      }
    },
  });

  console.log(`\nAttractor: running ${dotFile}\n`);

  let finalContext;
  try {
    finalContext = await engine.run(dotSource, {}, { variables, checkpoint });
  } catch (err) {
    console.error(`\nPipeline failed: ${err.message}`);
    process.exit(1);
  }

  console.log('\nPipeline complete.');
  if (debug) {
    console.log('\nFinal context:');
    console.log(JSON.stringify(finalContext, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
