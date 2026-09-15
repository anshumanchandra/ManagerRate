/* ========================================
   API Client — Axios Instance + Admin & Verify
   ======================================== */

import axios, { AxiosError } from 'axios';
import type {
  ManagerListResponse,
  ManagerProfile,
  DashboardStats,
  ReviewSubmission,
  ApiError,
  AdminDashboardStats,
  AdminReviewsResponse,
  AdminManagersResponse,
  AdminManager,
  VerifySendCodeResponse,
  VerifyConfirmResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — normalize errors
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 429) {
      const msg =
        error.response.data?.error ||
        'Too many requests. Please wait and try again.';
      return Promise.reject(new Error(msg));
    }
    if (error.response?.data?.error) {
      return Promise.reject(new Error(error.response.data.error));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }
    return Promise.reject(new Error('Something went wrong. Please try again.'));
  }
);

/* ==========================================
   Public — Managers
   ========================================== */

export async function fetchManagers(params: {
  q?: string;
  company?: string;
  minRating?: number;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<ManagerListResponse> {
  const { data } = await api.get('/managers', { params });
  return data;
}

export async function fetchManager(id: string): Promise<ManagerProfile> {
  const { data } = await api.get(`/managers/${id}`);
  return data;
}

/* ==========================================
   Public — Reviews
   ========================================== */

export async function submitReview(review: ReviewSubmission): Promise<{
  success: boolean;
  message: string;
  reviewId: string;
  notice?: string;
}> {
  const { data } = await api.post('/reviews', review);
  return data;
}

export async function toggleHelpful(reviewId: string): Promise<{
  voted: boolean;
  helpfulCount: number;
}> {
  const { data } = await api.post(`/reviews/${reviewId}/helpful`);
  return data;
}

export async function reportReview(
  reviewId: string,
  reason: string,
  details?: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post(`/reviews/${reviewId}/report`, {
    reason,
    details,
  });
  return data;
}

/* ==========================================
   Public — Stats
   ========================================== */

export async function fetchStats(): Promise<DashboardStats> {
  const { data } = await api.get('/stats');
  return data;
}

/* ==========================================
   Public — Health
   ========================================== */

export async function healthCheck(): Promise<{ status: string }> {
  const { data } = await api.get('/health');
  return data;
}

/* ==========================================
   Admin APIs — require adminFetch from useAdmin
   ========================================== */

/**
 * Helper: create admin-scoped fetch methods.
 * `adminFetch` is the authenticated fetch from `useAdmin` hook
 * that attaches the JWT and auto-logouts on 401.
 */
export function createAdminApi(adminFetch: (url: string, options?: RequestInit) => Promise<Response>) {

  async function jsonOrThrow<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  return {
    /* ---------- Dashboard ---------- */

    async getDashboard(): Promise<AdminDashboardStats> {
      const res = await adminFetch('/api/admin/dashboard');
      return jsonOrThrow(res);
    },

    /* ---------- Reviews ---------- */

    async getReviews(params: {
      q?: string;
      flagged?: boolean;
      verified?: boolean;
      sort?: string;
      page?: number;
      limit?: number;
    } = {}): Promise<AdminReviewsResponse> {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.flagged !== undefined) qs.set('flagged', String(params.flagged));
      if (params.verified !== undefined) qs.set('verified', String(params.verified));
      if (params.sort) qs.set('sort', params.sort);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      const res = await adminFetch(`/api/admin/reviews?${qs.toString()}`);
      return jsonOrThrow(res);
    },

    async deleteReview(id: string): Promise<{ success: boolean; message: string }> {
      const res = await adminFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      return jsonOrThrow(res);
    },

    async toggleFlag(id: string): Promise<{ flagged: boolean }> {
      const res = await adminFetch(`/api/admin/reviews/${id}/flag`, { method: 'PATCH' });
      return jsonOrThrow(res);
    },

    /* ---------- Managers ---------- */

    async getManagers(params: {
      q?: string;
      page?: number;
      limit?: number;
    } = {}): Promise<AdminManagersResponse> {
      const qs = new URLSearchParams();
      if (params.q) qs.set('q', params.q);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      const res = await adminFetch(`/api/admin/managers?${qs.toString()}`);
      return jsonOrThrow(res);
    },

    async deleteManager(key: string): Promise<{ success: boolean; message: string }> {
      const res = await adminFetch(`/api/admin/managers/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      return jsonOrThrow(res);
    },

    async updateManager(
      key: string,
      updates: Partial<Pick<AdminManager, 'name' | 'companies'>>,
    ): Promise<AdminManager> {
      const res = await adminFetch(`/api/admin/managers/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return jsonOrThrow(res);
    },
  };
}

/* ==========================================
   Email Verification APIs
   ========================================== */

export async function sendVerificationCode(email: string): Promise<VerifySendCodeResponse> {
  const { data } = await api.post('/verify/send-code', { email });
  return data;
}

export async function confirmVerificationCode(
  email: string,
  code: string,
): Promise<VerifyConfirmResponse> {
  const { data } = await api.post('/verify/confirm-code', { email, code });
  return data;
}
