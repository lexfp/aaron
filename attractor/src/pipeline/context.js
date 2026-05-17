export class PipelineContext {
  #store;

  constructor(initial = {}) {
    this.#store = { ...initial };
  }

  get(key)        { return this.#store[key]; }
  set(key, value) { this.#store[key] = value; }
  has(key)        { return key in this.#store; }
  delete(key)     { delete this.#store[key]; }

  merge(obj) {
    Object.assign(this.#store, obj);
  }

  // Evaluate a JavaScript expression with context variables in scope.
  // Supports simple conditions like "approved == true" or "count > 3".
  evaluate(expr) {
    if (!expr || expr.trim() === '') return true;
    try {
      const keys   = Object.keys(this.#store);
      const values = Object.values(this.#store);
      // eslint-disable-next-line no-new-func
      return Boolean(new Function(...keys, `return (${expr});`)(...values));
    } catch {
      return false;
    }
  }

  snapshot() {
    return { ...this.#store };
  }

  restore(snapshot) {
    this.#store = { ...snapshot };
  }

  toJSON() {
    return this.snapshot();
  }
}
