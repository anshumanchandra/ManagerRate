/* ========================================
   useProDashboard — Pro Dashboard Data Hook
   ========================================
   Manages API key from sessionStorage,
   fetches all dashboard endpoints, handles
   auth errors, auto-refreshes every 5 min.
   ======================================== */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api/pro/dashboard';
const SESSION_KEY = 'mr_pro_api_key';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ─── Types ──────────────────────────────

export interface DashboardManager {
  id: string;
  name: string;
  linkedinUrl: string;
  linkedinSlug: string;
  avgRating: number;
  reviewCount: number;
  recommendPct: number;
  trend: 'up' | 'down' | 'stable';
  latestReviewDate: string | null;
  categoryAvgs: Record<string, number>;
}

export interface DashboardOverview {
  company: string;
  totalManagers: number;
  totalReviews: number;
  avgRating: number;
  recommendPct: number;
  topManagers: Array<{ id: string; name: string; avgRating: number; reviewCount: number; recommendPct: number }>;
  lowestManagers: Array<{ id: string; name: string; avgRating: number; reviewCount: number; recommendPct: number }>;
  categoryAvgs: Record<string, number>;
}

export interface TrendMonth {
  label: string;
  year: number;
  month: number;
  reviewCount: number;
  avgRating: number | null;
  recommendPct: number | null;
  categoryAvgs: Record<string, number | null>;
}

export interface DashboardTrends {
  company: string;
  months: TrendMonth[];
  overallTrend: 'up' | 'down' | 'stable';
  periodStart: string;
  periodEnd: string;
}

export interface DashboardAlert {
  type: 'declining_ratings' | 'low_recommend' | 'flagged_reviews' | 'new_reviews';
  severity: 'high' | 'medium' | 'info';
  manager: string;
  managerId: string;
  message: string;
  data: Record<string, unknown>;
}

export interface DashboardAlerts {
  company: string;
  alerts: DashboardAlert[];
  total: number;
}

// ─── Helper: make authenticated request ─

function proRequest(endpoint: string, apiKey: string) {
  return axios.get(`${API_BASE}${endpoint}`, {
    headers: { 'X-API-Key': apiKey },
    timeout: 15000,
  });
}

// ─── Hook ───────────────────────────────

export function useProDashboard() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    try { return sessionStorage.getItem(SESSION_KEY); }
    catch { return null; }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(!!apiKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [managers, setManagers] = useState<DashboardManager[]>([]);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);

  const refreshRef = useRef<ReturnType<typeof setInterval>>();

  // Set API key (login)
  const login = useCallback(async (key: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // Validate key by hitting the overview endpoint
      await proRequest('/overview', key);
      // Key is valid — store in sessionStorage only (cleared on tab close)
      try { sessionStorage.setItem(SESSION_KEY, key); }
      catch { /* sessionStorage may be blocked */ }
      setApiKeyState(key);
      setIsAuthenticated(true);
      setLoading(false);
      return true;
    } catch (err: unknown) {
      setLoading(false);
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('Invalid API key. Please check and try again.');
        } else if (err.response?.status === 403) {
          setError('This API key does not have dashboard access.');
        } else if (err.response?.status === 429) {
          setError('Too many requests. Please wait and try again.');
        } else {
          setError('Connection failed. Please check your network.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
      return false;
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); }
    catch { /* ignore */ }
    setApiKeyState(null);
    setIsAuthenticated(false);
    setOverview(null);
    setManagers([]);
    setTrends(null);
    setAlerts(null);
    if (refreshRef.current) clearInterval(refreshRef.current);
  }, []);

  // Fetch all dashboard data
  const fetchAll = useCallback(async (sort?: string) => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const [ovRes, mgrRes, trnRes, altRes] = await Promise.all([
        proRequest('/overview', apiKey),
        proRequest(`/managers?sort=${sort || 'rating_desc'}`, apiKey),
        proRequest('/trends', apiKey),
        proRequest('/alerts', apiKey),
      ]);

      setOverview(ovRes.data);
      setManagers(mgrRes.data.managers || []);
      setTrends(trnRes.data);
      setAlerts(altRes.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        // API key expired or revoked
        logout();
        setError('Your API key has expired. Please log in again.');
      } else {
        setError('Failed to load dashboard data. Retrying...');
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, logout]);

  // Fetch managers with different sort
  const sortManagers = useCallback(async (sort: string) => {
    if (!apiKey) return;
    try {
      const res = await proRequest(`/managers?sort=${sort}`, apiKey);
      setManagers(res.data.managers || []);
    } catch { /* ignore sort errors */ }
  }, [apiKey]);

  // Export data
  const exportData = useCallback(async () => {
    if (!apiKey) return null;
    try {
      const res = await proRequest('/export', apiKey);
      return res.data;
    } catch {
      return null;
    }
  }, [apiKey]);

  // Auto-fetch on login and auto-refresh every 5 minutes
  useEffect(() => {
    if (isAuthenticated && apiKey) {
      fetchAll();
      refreshRef.current = setInterval(() => fetchAll(), REFRESH_INTERVAL);
      return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
    }
  }, [isAuthenticated, apiKey, fetchAll]);

  return {
    // Auth
    apiKey,
    isAuthenticated,
    login,
    logout,

    // Data
    overview,
    managers,
    trends,
    alerts,

    // State
    loading,
    error,

    // Actions
    fetchAll,
    sortManagers,
    exportData,
  };
}
