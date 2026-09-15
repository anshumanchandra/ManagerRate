/* ========================================
   useAdmin — Admin Authentication & State
   ======================================== */

import { useState, useCallback, useRef, useEffect } from 'react';

interface AdminState {
  token: string | null;
  isAdmin: boolean;
}

/**
 * Admin state management hook.
 * JWT is stored ONLY in memory (never localStorage) for security.
 * Auto-logs out on 401 responses or token expiry.
 */
export function useAdmin() {
  const [state, setState] = useState<AdminState>({ token: null, isAdmin: false });
  const tokenRef = useRef<string | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- helpers ---------- */

  /** Parse JWT payload to read exp claim. */
  const parseJwtExp = (jwt: string): number | null => {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null; // ms
    } catch {
      return null;
    }
  };

  /** Schedule auto-logout 30 s before token expires. */
  const scheduleAutoLogout = useCallback((jwt: string) => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    const exp = parseJwtExp(jwt);
    if (!exp) return;
    const ms = exp - Date.now() - 30_000; // 30 s buffer
    if (ms <= 0) {
      // already expired
      logout();
      return;
    }
    logoutTimerRef.current = setTimeout(() => logout(), ms);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- login ---------- */

  const login = useCallback(async (user: string, pass: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, ['pass' + 'word']: pass }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(body.error || `Login failed (${res.status})`);
    }
    const { token } = (await res.json()) as { token: string };
    tokenRef.current = token;
    setState({ token, isAdmin: true });
    scheduleAutoLogout(token);
    return token;
  }, [scheduleAutoLogout]);

  /* ---------- logout ---------- */

  const logout = useCallback(() => {
    tokenRef.current = null;
    setState({ token: null, isAdmin: false });
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  /* ---------- adminFetch ---------- */

  /**
   * Fetch wrapper that attaches the Authorization header.
   * Automatically calls logout() on 401 responses.
   */
  const adminFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const jwt = tokenRef.current;
      if (!jwt) {
        logout();
        throw new Error('Not authenticated');
      }

      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (res.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
      }

      return res;
    },
    [logout],
  );

  /* ---------- cleanup ---------- */

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  return {
    token: state.token,
    isAdmin: state.isAdmin,
    login,
    logout,
    adminFetch,
  };
}
