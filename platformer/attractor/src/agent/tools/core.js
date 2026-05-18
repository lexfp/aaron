// Core tools shared across all provider profiles.

export const READ_FILE = {
  name: 'read_file',
  description: 'Read the contents of a file at the given path. Returns the file content as a string.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The path to the file to read (relative to working directory)' },
    },
    required: ['path'],
  },
  async execute({ path }, env) {
    return env.readFile(path);
  },
};

export const WRITE_FILE = {
  name: 'write_file',
  description: 'Write content to a file, creating parent directories as needed.',
  parameters: {
    type: 'object',
    properties: {
      path:    { type: 'string', description: 'The path to write to' },
      content: { type: 'string', description: 'The content to write' },
    },
    required: ['path', 'content'],
  },
  async execute({ path, content }, env) {
    return env.writeFile(path, content);
  },
};

export const SHELL = {
  name: 'shell',
  description: 'Execute a shell command and return its output. Avoid interactive commands.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  async execute({ command, timeout }, env) {
    return env.shell(command, { timeout });
  },
};

export const GLOB = {
  name: 'glob',
  description: 'Find files matching a glob pattern. Use ** for recursive matching.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern e.g. "src/**/*.js"' },
      cwd:     { type: 'string', description: 'Base directory (optional)' },
    },
    required: ['pattern'],
  },
  async execute({ pattern, cwd }, env) {
    const matches = await env.glob(pattern, { cwd });
    return matches.length > 0 ? matches.join('\n') : '(no matches)';
  },
};

export const GREP = {
  name: 'grep',
  description: 'Search for a pattern in files. Returns matching lines with line numbers.',
  parameters: {
    type: 'object',
    properties: {
      pattern:    { type: 'string',  description: 'Regex pattern to search for' },
      path:       { type: 'string',  description: 'File or directory to search in' },
      recursive:  { type: 'boolean', description: 'Search recursively in directories' },
      ignoreCase: { type: 'boolean', description: 'Case-insensitive matching' },
    },
    required: ['pattern', 'path'],
  },
  async execute({ pattern, path, recursive, ignoreCase }, env) {
    return env.grep(pattern, path, { recursive, ignoreCase });
  },
};

export const LIST_DIR = {
  name: 'list_dir',
  description: 'List files and directories at the given path.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (default: current directory)' },
    },
    required: [],
  },
  async execute({ path = '.' }, env) {
    return env.listDir(path);
  },
};

export const CORE_TOOLS = [READ_FILE, WRITE_FILE, SHELL, GLOB, GREP, LIST_DIR];
