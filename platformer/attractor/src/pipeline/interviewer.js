import readline from 'node:readline';

// CLI implementation of the Interviewer pattern.
// The same interface can be implemented for web, Slack, etc.
export class CLIInterviewer {
  async ask(question, options = {}) {
    const timeout      = options.timeout ?? null;
    const defaultValue = options.default ?? null;

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input:  process.stdin,
        output: process.stdout,
        terminal: false,
      });

      let timer;
      if (timeout !== null && defaultValue !== null) {
        timer = setTimeout(() => {
          rl.close();
          console.log(`\n[Attractor] Timed out — using default: ${defaultValue}`);
          resolve(String(defaultValue));
        }, timeout);
      }

      const prompt = defaultValue !== null
        ? `\n[Attractor] ${question} [default: ${defaultValue}]\n> `
        : `\n[Attractor] ${question}\n> `;

      rl.question(prompt, (answer) => {
        clearTimeout(timer);
        rl.close();
        const result = answer.trim() || String(defaultValue ?? '');
        resolve(result);
      });
    });
  }
}

// No-op interviewer for automated/non-interactive pipelines.
export class NoopInterviewer {
  constructor(defaultResponse = 'y') {
    this.defaultResponse = defaultResponse;
  }

  async ask(question, options = {}) {
    const value = options.default ?? this.defaultResponse;
    console.log(`[Attractor][noop] Question: "${question}" → "${value}"`);
    return String(value);
  }
}
