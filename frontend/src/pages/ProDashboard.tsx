/* ========================================
   ProDashboard — Company Dashboard Page
   ========================================
   Beautiful dashboard for organizations to
   monitor their managers' leadership ratings.
   Requires Pro API key for access.
   ======================================== */

import { useState, useEffect, useRef } from 'react';
import { useProDashboard } from '../hooks/useProDashboard';
import type { DashboardManager, DashboardAlert, TrendMonth } from '../hooks/useProDashboard';
import ProLogin from '../components/ProLogin';

// ─── Rating color helper ────────────────
function ratingColor(val: number): string {
  if (val >= 4) return 'text-green-600';
  if (val >= 3) return 'text-blue-600';
  if (val >= 2) return 'text-orange-500';
  return 'text-red-600';
}

function ratingBgColor(val: number): string {
  if (val >= 4) return 'bg-green-500';
  if (val >= 3) return 'bg-blue-500';
  if (val >= 2) return 'bg-orange-500';
  return 'bg-red-500';
}

function trendIcon(trend: string) {
  if (trend === 'up') return <span className="text-green-500 text-lg">↑</span>;
  if (trend === 'down') return <span className="text-red-500 text-lg">↓</span>;
  return <span className="text-gray-400 text-lg">→</span>;
}

function severityStyles(severity: string) {
  if (severity === 'high') return 'border-red-300 bg-red-50';
  if (severity === 'medium') return 'border-orange-300 bg-orange-50';
  return 'border-blue-200 bg-blue-50';
}

function severityIcon(severity: string) {
  if (severity === 'high') return '🔴';
  if (severity === 'medium') return '🟡';
  return '🔵';
}

// ─── Animated Counter ───────────────────
function AnimatedCounter({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current || !value) return;
    animated.current = true;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  return <span ref={ref}>{decimals ? display.toFixed(decimals) : Math.round(display)}{suffix}</span>;
}

// ─── Mini Trend Chart (SVG) ─────────────
function TrendChart({ months }: { months: TrendMonth[] }) {
  const values = months.map(m => m.avgRating).filter((v): v is number => v !== null);
  if (values.length < 2) return <p className="text-sm text-gray-400 text-center py-8">Not enough data for trend chart</p>;

  const max = Math.max(...values, 5);
  const min = Math.min(...values, 1);
  const range = max - min || 1;
  const w = 100;
  const h = 40;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      {/* Gradient fill */}
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area */}
      <polygon
        points={`${padding},${h - padding} ${points} ${w - padding},${h - padding}`}
        fill="url(#trendGrad)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {values.map((v, i) => {
        const x = padding + (i / (values.length - 1)) * (w - padding * 2);
        const y = h - padding - ((v - min) / range) * (h - padding * 2);
        return <circle key={i} cx={x} cy={y} r="1.5" fill="#3b82f6" />;
      })}
    </svg>
  );
}

// ─── Category Bar ───────────────────────
function CategoryBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-44 text-gray-600 truncate flex-shrink-0">{name}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${ratingBgColor(value)}`}
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className={`w-8 text-right font-mono font-semibold text-xs ${ratingColor(value)}`}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Main Dashboard Page ────────────────
export default function ProDashboard() {
  const {
    isAuthenticated, login, logout, loading, error,
    overview, managers, trends, alerts,
    sortManagers, exportData,
  } = useProDashboard();

  const [managerSort, setManagerSort] = useState('rating_desc');

  // Handle sort change
  const handleSort = (sort: string) => {
    setManagerSort(sort);
    sortManagers(sort);
  };

  // Handle export
  const handleExport = async () => {
    const data = await exportData();
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `managerrate-export-${data.company}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <ProLogin onLogin={login} loading={loading} error={error} />;
  }

  // Loading state
  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-64 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-40 mb-6" />
              <div className="h-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {overview?.company || 'Company'} Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time leadership insights &middot; Auto-refreshes every 5 min
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Managers Reviewed</p>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedCounter value={overview?.totalManagers || 0} />
          </p>
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            At {overview?.company}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Average Rating</p>
          <p className={`text-3xl font-bold ${ratingColor(overview?.avgRating || 0)}`}>
            <AnimatedCounter value={overview?.avgRating || 0} decimals={1} />
          </p>
          <p className="text-xs text-gray-500 mt-1">out of 5.0</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Would Recommend</p>
          <p className="text-3xl font-bold text-green-600">
            <AnimatedCounter value={overview?.recommendPct || 0} suffix="%" />
          </p>
          <p className="text-xs text-gray-500 mt-1">of all reviewers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Total Reviews</p>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedCounter value={overview?.totalReviews || 0} />
          </p>
          <p className="text-xs text-gray-500 mt-1">anonymous reviews</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rating Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Rating Trend (12 months)</h3>
            {trends && trendIcon(trends.overallTrend)}
          </div>
          {trends ? (
            <>
              <TrendChart months={trends.months} />
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{trends.periodStart}</span>
                <span>{trends.periodEnd}</span>
              </div>
            </>
          ) : (
            <div className="h-32 bg-gray-50 rounded animate-pulse" />
          )}
        </div>

        {/* Category Averages */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Category Averages</h3>
          <div className="space-y-2.5">
            {overview ? (
              Object.entries(overview.categoryAvgs)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, val]) => (
                  <CategoryBar key={cat} name={cat} value={val} />
                ))
            ) : (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 bg-gray-100 rounded w-36 animate-pulse" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full animate-pulse" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Alerts ({alerts.total})
          </h3>
          <div className="space-y-3">
            {alerts.alerts.map((alert: DashboardAlert, i: number) => (
              <div key={i} className={`p-4 border rounded-lg flex items-start gap-3 ${severityStyles(alert.severity)}`}>
                <span className="text-lg">{severityIcon(alert.severity)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {alert.type === 'declining_ratings' && 'Ratings trending downward — consider follow-up'}
                    {alert.type === 'low_recommend' && 'Below healthy threshold (40%) — attention needed'}
                    {alert.type === 'flagged_reviews' && 'Under moderation review'}
                    {alert.type === 'new_reviews' && 'Recent activity for this manager'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manager Leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900">Manager Leaderboard</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Sort:</label>
            <select
              value={managerSort}
              onChange={(e) => handleSort(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="rating_desc">Highest Rated</option>
              <option value="rating_asc">Lowest Rated</option>
              <option value="reviews_desc">Most Reviews</option>
              <option value="newest">Most Recent</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">#</th>
                <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Manager</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rating</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reviews</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Recommend</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Trend</th>
                <th className="text-left py-3 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide min-w-[160px]">Rating Bar</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m: DashboardManager, i: number) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-2 text-gray-400 font-mono text-xs">{i + 1}</td>
                  <td className="py-3 px-2">
                    <div className="font-semibold text-gray-900">{m.name}</div>
                    {m.linkedinUrl && (
                      <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                        LinkedIn
                      </a>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`font-bold font-mono ${ratingColor(m.avgRating)}`}>{m.avgRating.toFixed(1)}</span>
                  </td>
                  <td className="py-3 px-2 text-center text-gray-600">{m.reviewCount}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={m.recommendPct >= 60 ? 'text-green-600' : m.recommendPct >= 40 ? 'text-orange-500' : 'text-red-600'}>
                      {m.recommendPct}%
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">{trendIcon(m.trend)}</td>
                  <td className="py-3 px-2">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ratingBgColor(m.avgRating)}`}
                        style={{ width: `${(m.avgRating / 5) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {managers.length === 0 && (
            <p className="text-center py-8 text-gray-400">No managers reviewed at this company yet</p>
          )}
        </div>
      </div>

      {/* Top & Lowest */}
      {overview && (overview.topManagers.length > 0 || overview.lowestManagers.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Managers */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🏆</span> Top Rated
            </h3>
            <div className="space-y-3">
              {overview.topManagers.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-medium text-gray-900">{m.name}</span>
                  </div>
                  <span className="font-bold font-mono text-green-600">{m.avgRating.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Attention */}
          {overview.lowestManagers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-lg">📋</span> Needs Attention
              </h3>
              <div className="space-y-3">
                {overview.lowestManagers.map((m, i) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-900">{m.name}</span>
                    </div>
                    <span className={`font-bold font-mono ${ratingColor(m.avgRating)}`}>{m.avgRating.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4 text-xs text-gray-400">
        ManagerRate Pro &middot; Data refreshes automatically every 5 minutes &middot;{' '}
        <button onClick={logout} className="underline hover:text-gray-600">
          Disconnect
        </button>
      </div>
    </div>
  );
}
