"use client";

import { createContext, useCallback, useMemo, useSyncExternalStore } from "react";
import { session } from "@/lib/session";
import { authService } from "@/services";
import type { User } from "@/types";

export interface AuthContextValue {
  user: User | null;
  /** False during server render / hydration, before the stored session can be read. */
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  logout: () => Promise<void>;
  /** Refreshes the signed-in user's details, e.g. after editing the profile. */
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// `undefined` on the server marks "not ready yet"; `null` on the client means "logged out".
const getServerSnapshot = () => undefined;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(session.subscribe, session.getUserSnapshot, getServerSnapshot);

  const user = useMemo<User | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const result = await authService.login({ email, password, remember });
    session.save(result.token, result.user, remember);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Still sign out locally if the API is unreachable or the token already expired.
    } finally {
      session.clear();
    }
  }, []);

  const updateUser = useCallback((next: User) => session.updateUser(next), []);

  const value = useMemo(
    () => ({ user, ready: raw !== undefined, login, logout, updateUser }),
    [user, raw, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
