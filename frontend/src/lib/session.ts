/**
 * Session (token + user), observable via useSyncExternalStore.
 * "Remember me" keeps it in localStorage; otherwise sessionStorage, which ends with the browser tab.
 */

const TOKEN_KEY = "mm_token";
const USER_KEY = "mm_user";
const listeners = new Set<() => void>();

type StoreName = "localStorage" | "sessionStorage";
const STORES: StoreName[] = ["localStorage", "sessionStorage"];

function read(key: string) {
  for (const name of STORES) {
    try {
      const value = window[name].getItem(key);
      if (value !== null) return value;
    } catch {
      // Storage unavailable (private mode, blocked site data).
    }
  }
  return null;
}

/** Which storage currently holds the session, so updates stay in the same place. */
function activeStore(): Storage | null {
  for (const name of STORES) {
    try {
      if (window[name].getItem(TOKEN_KEY)) return window[name];
    } catch {
      // ignore
    }
  }
  return null;
}

function emit() {
  listeners.forEach((l) => l());
}

export const session = {
  getToken: () => read(TOKEN_KEY),

  /** Raw JSON string of the stored user, so snapshots compare stably. */
  getUserSnapshot: () => (read(TOKEN_KEY) ? read(USER_KEY) : null),

  save(token: string, user: unknown, remember: boolean) {
    session.clear(false);
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
    emit();
  },

  updateUser(user: unknown) {
    activeStore()?.setItem(USER_KEY, JSON.stringify(user));
    emit();
  },

  clear(notify = true) {
    for (const name of STORES) {
      try {
        window[name].removeItem(TOKEN_KEY);
        window[name].removeItem(USER_KEY);
      } catch {
        // Storage unavailable; nothing to clear.
      }
    }
    if (notify) emit();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    // Keep multiple tabs in sync.
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
};
