// Callback registry to break circular dependencies between modules
// Modules register their functions here, other modules call them via this registry

export const cb = {};

export function register(name, fn) {
    cb[name] = fn;
}
