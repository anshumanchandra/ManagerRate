/* ========================================
   Admin — Secure Admin Panel
   ======================================== */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { createAdminApi } from '../api/client';
import type {
  AdminDashboardStats,
  AdminReview,
  AdminManager,
  AdminReviewsResponse,
  AdminManagersResponse,
} from '../types';

/* ==========================================
   Admin Login Screen
   ========================================== */

function AdminLogin({ onLogin }: { onLogin: (u: string, p: string) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-primary/20 flex items-center justify-center">
            <i className="fa-solid fa-shield-halved text-primary text-2xl" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">ManagerRate Administration</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            <i className="fa-solid fa-circle-exclamation mr-1.5" />
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white outline-none focus:border-primary transition placeholder:text-gray-500"
            placeholder="admin"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white outline-none focus:border-primary transition placeholder:text-gray-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><i className="fa-solid fa-spinner fa-spin mr-2" />Signing in...</>
          ) : (
            <><i className="fa-solid fa-right-to-bracket mr-2" />Sign In</>
          )}
        </button>
      </form>
    </div>
  );
}

/* ==========================================
   Confirmation Dialog
   ========================================== */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   Edit Manager Modal
   ========================================== */

function EditManagerModal({
  manager,
  onSave,
  onClose,
}: {
  manager: AdminManager;
  onSave: (key: string, updates: { name?: string; companies?: string[] }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(manager.name);
  const [companies, setCompanies] = useState(manager.companies.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(manager.key, {
        name: name.trim(),
        companies: companies.split(',').map((c) => c.trim()).filter(Boolean),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-white mb-4">
          <i className="fa-solid fa-user-pen mr-2 text-primary" />
          Edit Manager
        </h3>

        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white outline-none focus:border-primary transition"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Companies <span className="text-gray-500">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={companies}
            onChange={(e) => setCompanies(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white outline-none focus:border-primary transition"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
          >
            {saving ? <><i className="fa-solid fa-spinner fa-spin mr-1" />Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   Stat Card
   ========================================== */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <i className={`fa-solid ${icon} text-lg`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   Main Admin Page Component
   ========================================== */

type Tab = 'dashboard' | 'reviews' | 'managers';

export default function Admin() {
  const { isAdmin, login, logout, adminFetch } = useAdmin();
  const adminApi = useMemo(() => createAdminApi(adminFetch), [adminFetch]);

  const [tab, setTab] = useState<Tab>('dashboard');

  /* ---------- Dashboard state ---------- */
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  /* ---------- Reviews state ---------- */
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'flagged' | 'verified'>('all');
  const [reviewSort, setReviewSort] = useState('-createdAt');
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  /* ---------- Managers state ---------- */
  const [managers, setManagers] = useState<AdminManager[]>([]);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerPage, setManagerPage] = useState(1);
  const [managerTotal, setManagerTotal] = useState(0);
  const [managersLoading, setManagersLoading] = useState(false);

  /* ---------- Dialogs ---------- */
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [editingManager, setEditingManager] = useState<AdminManager | null>(null);

  /* ---------- Error ---------- */
  const [error, setError] = useState('');

  /* ---------- Loaders ---------- */

  const loadDashboard = useCallback(async () => {
    setStatsLoading(true);
    setError('');
    try {
      const data = await adminApi.getDashboard();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setStatsLoading(false);
    }
  }, [adminApi]);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setError('');
    try {
      const params: Parameters<typeof adminApi.getReviews>[0] = {
        q: reviewSearch || undefined,
        sort: reviewSort,
        page: reviewPage,
        limit: 20,
      };
      if (reviewFilter === 'flagged') params.flagged = true;
      if (reviewFilter === 'verified') params.verified = true;
      const data: AdminReviewsResponse = await adminApi.getReviews(params);
      setReviews(data.reviews);
      setReviewTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setReviewsLoading(false);
    }
  }, [adminApi, reviewSearch, reviewFilter, reviewSort, reviewPage]);

  const loadManagers = useCallback(async () => {
    setManagersLoading(true);
    setError('');
    try {
      const data: AdminManagersResponse = await adminApi.getManagers({
        q: managerSearch || undefined,
        page: managerPage,
        limit: 20,
      });
      setManagers(data.managers);
      setManagerTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load managers');
    } finally {
      setManagersLoading(false);
    }
  }, [adminApi, managerSearch, managerPage]);

  /* ---------- Effects ---------- */

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'reviews') loadReviews();
    if (tab === 'managers') loadManagers();
  }, [isAdmin, tab, loadDashboard, loadReviews, loadManagers]);

  /* ---------- Actions ---------- */

  const handleDeleteReview = (id: string) => {
    setConfirmAction({
      title: 'Delete Review',
      message: `Permanently delete review ${id.slice(0, 8)}…? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await adminApi.deleteReview(id);
          setReviews((prev) => prev.filter((r) => r.id !== id));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Delete failed');
        }
      },
    });
  };

  const handleToggleFlag = async (id: string) => {
    try {
      const result = await adminApi.toggleFlag(id);
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, flagged: result.flagged } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flag toggle failed');
    }
  };

  const handleDeleteManager = (key: string, name: string) => {
    setConfirmAction({
      title: 'Delete Manager',
      message: `Delete "${name}" and all their reviews? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await adminApi.deleteManager(key);
          setManagers((prev) => prev.filter((m) => m.key !== key));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Delete failed');
        }
      },
    });
  };

  const handleEditManager = async (
    key: string,
    updates: { name?: string; companies?: string[] },
  ) => {
    const updated = await adminApi.updateManager(key, updates);
    setManagers((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...updated } : m)),
    );
  };

  /* ---------- Render: Login ---------- */

  if (!isAdmin) {
    return <AdminLogin onLogin={login} />;
  }

  /* ---------- Render: Dashboard ---------- */

  const sidebarItems: { tab: Tab; icon: string; label: string }[] = [
    { tab: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
    { tab: 'reviews', icon: 'fa-comments', label: 'Reviews' },
    { tab: 'managers', icon: 'fa-users', label: 'Managers' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-800 border-r border-gray-700/50 flex flex-col">
        <div className="p-5 border-b border-gray-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <i className="fa-solid fa-shield-halved text-primary text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Admin Panel</p>
              <p className="text-[10px] text-gray-500">ManagerRate</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => setTab(item.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === item.tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-4 text-center`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-700/50">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
          >
            <i className="fa-solid fa-right-from-bracket w-4 text-center" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Global error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center justify-between">
            <span><i className="fa-solid fa-circle-exclamation mr-2" />{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        {/* ---- Dashboard Tab ---- */}
        {tab === 'dashboard' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-5">
              <i className="fa-solid fa-chart-line mr-2 text-primary" />
              Dashboard
            </h2>

            {statsLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-gray-800 rounded-xl p-5 border border-gray-700/50 animate-pulse">
                    <div className="h-10 bg-gray-700 rounded mb-2" />
                    <div className="h-4 bg-gray-700 rounded w-20" />
                  </div>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon="fa-comments" label="Total Reviews" value={stats.totalReviews} color="bg-blue-500/20 text-blue-400" />
                <StatCard icon="fa-users" label="Total Managers" value={stats.totalManagers} color="bg-green-500/20 text-green-400" />
                <StatCard icon="fa-flag" label="Flagged Reviews" value={stats.flaggedReviews} color="bg-red-500/20 text-red-400" />
                <StatCard icon="fa-circle-check" label="Verified Reviews" value={stats.verifiedReviews} color="bg-emerald-500/20 text-emerald-400" />
                <StatCard icon="fa-clock" label="Recent (7d)" value={stats.recentReviews} color="bg-purple-500/20 text-purple-400" />
                <StatCard icon="fa-star" label="Avg Rating" value={stats.avgRating.toFixed(1)} color="bg-yellow-500/20 text-yellow-400" />
              </div>
            ) : null}
          </div>
        )}

        {/* ---- Reviews Tab ---- */}
        {tab === 'reviews' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-5">
              <i className="fa-solid fa-comments mr-2 text-primary" />
              Reviews
              <span className="ml-2 text-sm font-normal text-gray-400">({reviewTotal})</span>
            </h2>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                  <i className="fa-solid fa-magnifying-glass text-gray-500 mr-2 text-xs" />
                  <input
                    type="text"
                    value={reviewSearch}
                    onChange={(e) => { setReviewSearch(e.target.value); setReviewPage(1); }}
                    placeholder="Search reviews…"
                    className="bg-transparent text-sm text-white outline-none w-full placeholder:text-gray-500"
                  />
                </div>
              </div>

              <select
                value={reviewFilter}
                onChange={(e) => { setReviewFilter(e.target.value as typeof reviewFilter); setReviewPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none"
              >
                <option value="all">All Reviews</option>
                <option value="flagged">Flagged Only</option>
                <option value="verified">Verified Only</option>
              </select>

              <select
                value={reviewSort}
                onChange={(e) => { setReviewSort(e.target.value); setReviewPage(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none"
              >
                <option value="-createdAt">Newest First</option>
                <option value="createdAt">Oldest First</option>
                <option value="-reportCount">Most Reported</option>
              </select>
            </div>

            {/* Reviews Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
              {reviewsLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <i className="fa-solid fa-spinner fa-spin mr-2" />Loading reviews…
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No reviews found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Manager</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Company</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Excerpt</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reports</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((r) => (
                        <tr key={r.id} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{r.managerName}</td>
                          <td className="px-4 py-3 text-gray-400">{r.company}</td>
                          <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate" title={r.pros}>
                            {r.pros.slice(0, 60)}{r.pros.length > 60 ? '…' : ''}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {r.verified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <i className="fa-solid fa-circle-check" />Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-700 text-gray-400">
                                  Unverified
                                </span>
                              )}
                              {r.flagged && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                  <i className="fa-solid fa-flag" />Flagged
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-mono text-xs ${r.reportCount > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                              {r.reportCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleFlag(r.id)}
                                title={r.flagged ? 'Unflag' : 'Flag'}
                                className={`p-1.5 rounded-md text-xs transition ${
                                  r.flagged
                                    ? 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
                                    : 'text-gray-500 hover:text-orange-400 hover:bg-orange-500/10'
                                }`}
                              >
                                <i className={`fa-solid ${r.flagged ? 'fa-flag' : 'fa-flag'}`} />
                              </button>
                              <button
                                onClick={() => handleDeleteReview(r.id)}
                                title="Delete review"
                                className="p-1.5 rounded-md text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
                              >
                                <i className="fa-solid fa-trash-can" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {reviewTotal > 20 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
                  <span className="text-xs text-gray-500">
                    Page {reviewPage} of {Math.ceil(reviewTotal / 20)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                      disabled={reviewPage <= 1}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-600 transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setReviewPage((p) => p + 1)}
                      disabled={reviewPage >= Math.ceil(reviewTotal / 20)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-600 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Managers Tab ---- */}
        {tab === 'managers' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-5">
              <i className="fa-solid fa-users mr-2 text-primary" />
              Managers
              <span className="ml-2 text-sm font-normal text-gray-400">({managerTotal})</span>
            </h2>

            {/* Search */}
            <div className="mb-4">
              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 max-w-md">
                <i className="fa-solid fa-magnifying-glass text-gray-500 mr-2 text-xs" />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(e) => { setManagerSearch(e.target.value); setManagerPage(1); }}
                  placeholder="Search managers…"
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Managers Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
              {managersLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <i className="fa-solid fa-spinner fa-spin mr-2" />Loading managers…
                </div>
              ) : managers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No managers found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Companies</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reviews</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Avg Rating</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Flagged</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managers.map((m) => (
                        <tr key={m.key} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {m.companies.slice(0, 2).join(', ')}
                            {m.companies.length > 2 && <span className="text-gray-500"> +{m.companies.length - 2}</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300 font-mono">{m.reviewCount}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-yellow-400 font-mono">
                              <i className="fa-solid fa-star text-[10px] mr-0.5" />
                              {m.avgRating.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {m.flaggedReviews > 0 ? (
                              <span className="text-red-400 font-mono">{m.flaggedReviews}</span>
                            ) : (
                              <span className="text-gray-600">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingManager(m)}
                                title="Edit manager"
                                className="p-1.5 rounded-md text-xs text-gray-500 hover:text-primary hover:bg-primary/10 transition"
                              >
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button
                                onClick={() => handleDeleteManager(m.key, m.name)}
                                title="Delete manager"
                                className="p-1.5 rounded-md text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
                              >
                                <i className="fa-solid fa-trash-can" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {managerTotal > 20 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
                  <span className="text-xs text-gray-500">
                    Page {managerPage} of {Math.ceil(managerTotal / 20)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setManagerPage((p) => Math.max(1, p - 1))}
                      disabled={managerPage <= 1}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-600 transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setManagerPage((p) => p + 1)}
                      disabled={managerPage >= Math.ceil(managerTotal / 20)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-600 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {editingManager && (
        <EditManagerModal
          manager={editingManager}
          onSave={handleEditManager}
          onClose={() => setEditingManager(null)}
        />
      )}
    </div>
  );
}
