import { CORE_TOOLS, READ_FILE, WRITE_FILE, SHELL, GLOB, GREP, LIST_DIR } from './core.js';

// ── Anthropic profile — edit_file with old_string/new_string (Claude Code style) ──
const ANTHROPIC_EDIT_FILE = {
  name: 'edit_file',
  description: 'Edit a file by replacing a specific string with a new string. The old_string must match exactly (including whitespace).',
  parameters: {
    type: 'object',
    properties: {
      path:       { type: 'string', description: 'Path to the file to edit' },
      old_string: { type: 'string', description: 'The exact string to find and replace' },
      new_string: { type: 'string', description: 'The replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute({ path, old_string, new_string }, env) {
    const content = await env.readFile(path);
    if (!content.includes(old_string)) {
      throw new Error(`old_string not found in ${path}`);
    }
    const updated = content.replace(old_string, new_string);
    await env.writeFile(path, updated);
    return `Replaced in ${path}`;
  },
};

// ── OpenAI profile — apply_patch in unified-diff style ─────────────────────────
const OPENAI_APPLY_PATCH = {
  name: 'apply_patch',
  description: 'Apply a unified diff patch to a file. Format: +lines are added, -lines are removed.',
  parameters: {
    type: 'object',
    properties: {
      path:  { type: 'string', description: 'Path to the file to patch' },
      patch: { type: 'string', description: 'Unified diff format patch content' },
    },
    required: ['path', 'patch'],
  },
  async execute({ path, patch }, env) {
    // Simple hunk-based patch application
    const lines   = (await env.readFile(path)).split('\n');
    const hunks   = patch.split(/^@@/m).slice(1);

    for (const hunk of hunks) {
      const header = hunk.match(/^ [-+,\d]+ [-+,\d]+ @@/);
      if (!header) continue;

      const body     = hunk.slice(header[0].length);
      const removes  = body.split('\n').filter(l => l.startsWith('-')).map(l => l.slice(1));
      const adds     = body.split('\n').filter(l => l.startsWith('+')).map(l => l.slice(1));
      const context  = body.split('\n').filter(l => l.startsWith(' ')).map(l => l.slice(1));

      // Find anchor via context lines and apply
      const anchor = context[0];
      const idx    = anchor ? lines.findIndex(l => l === anchor) : 0;
      if (idx !== -1) {
        const removeStart = idx;
        lines.splice(removeStart, removes.length, ...adds);
      }
    }

    await env.writeFile(path, lines.join('\n'));
    return `Patch applied to ${path}`;
  },
};

// ── Gemini profile — search_and_replace ────────────────────────────────────────
const GEMINI_SEARCH_REPLACE = {
  name: 'search_and_replace',
  description: 'Replace all occurrences of a pattern in a file.',
  parameters: {
    type: 'object',
    properties: {
      path:        { type: 'string', description: 'Path to the file' },
      search:      { type: 'string', description: 'Text to search for' },
      replace:     { type: 'string', description: 'Replacement text' },
      regex:       { type: 'boolean', description: 'Treat search as a regex pattern' },
      ignoreCase:  { type: 'boolean', description: 'Case-insensitive matching' },
    },
    required: ['path', 'search', 'replace'],
  },
  async execute({ path, search, replace, regex, ignoreCase }, env) {
    const content = await env.readFile(path);
    let pattern;
    if (regex) {
      pattern = new RegExp(search, `g${ignoreCase ? 'i' : ''}`);
    } else {
      pattern = ignoreCase
        ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        : search;
    }
    const updated = content.replaceAll ? content.replaceAll(pattern, replace) : content.replace(pattern, replace);
    await env.writeFile(path, updated);
    return `Replaced in ${path}`;
  },
};

// ── Web search (shared) ────────────────────────────────────────────────────────
const WEB_SEARCH = {
  name: 'web_search',
  description: 'Search the web for information. Returns a list of relevant snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async execute({ query }, env) {
    // Delegates to the execution environment; implementations may vary.
    if (typeof env.webSearch === 'function') return env.webSearch(query);
    throw new Error('web_search is not available in this execution environment');
  },
};

// ── Profile registry ───────────────────────────────────────────────────────────
export const PROFILES = {
  anthropic: {
    name: 'anthropic',
    tools: [...CORE_TOOLS, ANTHROPIC_EDIT_FILE],
  },
  openai: {
    name: 'openai',
    tools: [...CORE_TOOLS, OPENAI_APPLY_PATCH],
  },
  gemini: {
    name: 'gemini',
    tools: [...CORE_TOOLS, GEMINI_SEARCH_REPLACE, WEB_SEARCH],
  },
};

export function getProfile(name = 'anthropic') {
  return PROFILES[name] ?? PROFILES.anthropic;
}
