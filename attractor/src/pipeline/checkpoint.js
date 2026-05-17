import { readFile, writeFile, unlink } from 'node:fs/promises';

export class CheckpointManager {
  constructor(path = '.attractor-checkpoint.json') {
    this.path = path;
  }

  async save({ context, completedNodes, retryCounts, currentNode }) {
    const data = {
      savedAt: new Date().toISOString(),
      currentNode,
      completedNodes: [...completedNodes],
      retryCounts,
      context,
    };
    await writeFile(this.path, JSON.stringify(data, null, 2), 'utf8');
  }

  async load() {
    try {
      const raw = await readFile(this.path, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async clear() {
    try { await unlink(this.path); } catch {}
  }
}
