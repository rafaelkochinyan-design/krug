/**
 * Small synchronous key-value store for per-device preferences (language, test user).
 * Web: localStorage, which can be missing or throw (private mode, blocked storage), so every access is guarded.
 * Native: in-memory for now; phase 2 (mobile) swaps in persistent storage behind this same interface.
 */
const memory = new Map<string, string>();

function web(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export const storage = {
  get(key: string): string | undefined {
    try {
      return web()?.getItem(key) ?? memory.get(key);
    } catch {
      return memory.get(key);
    }
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      web()?.setItem(key, value);
    } catch {
      // Storage unavailable: the in-memory value still works for this session.
    }
  },
};
