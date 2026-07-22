"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AuthUserDto } from "@sfb/shared";
import { API_URL } from "@/lib/config";

interface AuthContextValue {
  user: AuthUserDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);
  // Access token lives only in memory (never localStorage) to limit XSS blast radius.
  const accessTokenRef = useRef<string | null>(null);

  const rawFetch = useCallback((path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (accessTokenRef.current) {
      headers.set("Authorization", `Bearer ${accessTokenRef.current}`);
    }
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) return false;
    const body = await res.json();
    accessTokenRef.current = body.accessToken;
    setUser(body.user);
    return true;
  }, []);

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      let res = await rawFetch(path, init);
      if (res.status === 401) {
        const refreshed = await refresh();
        if (refreshed) {
          res = await rawFetch(path, init);
        }
      }
      return res;
    },
    [rawFetch, refresh],
  );

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // Restore the session once on mount using the httpOnly refresh cookie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const body = await res.json();
    accessTokenRef.current = body.accessToken;
    setUser(body.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const body = await res.json();
    accessTokenRef.current = body.accessToken;
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
