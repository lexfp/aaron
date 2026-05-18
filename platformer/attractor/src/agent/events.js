export const Events = {
  SESSION_START:        'SESSION_START',
  USER_INPUT:           'USER_INPUT',
  ASSISTANT_TEXT_DELTA: 'ASSISTANT_TEXT_DELTA',
  ASSISTANT_TEXT_END:   'ASSISTANT_TEXT_END',
  TOOL_CALL_START:      'TOOL_CALL_START',
  TOOL_CALL_END:        'TOOL_CALL_END',
  STEERING_INJECTED:    'STEERING_INJECTED',
  ROUND_LIMIT_REACHED:  'ROUND_LIMIT_REACHED',
  TURN_LIMIT_REACHED:   'TURN_LIMIT_REACHED',
  LOOP_DETECTED:        'LOOP_DETECTED',
  SESSION_END:          'SESSION_END',
  ERROR:                'ERROR',
};

export class EventEmitter {
  #listeners = new Map();

  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push(listener);
    return this;
  }

  off(event, listener) {
    const list = this.#listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
    return this;
  }

  emit(event, data) {
    const list = this.#listeners.get(event) ?? [];
    const wildcards = this.#listeners.get('*') ?? [];
    for (const fn of [...list, ...wildcards]) {
      try { fn({ type: event, ...data }); } catch {}
    }
  }
}
