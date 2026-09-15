/* ========================================
   Dashboard — Stats & Analytics
   ======================================== */

import { useEffect, useRef, useCallback } from 'react';
import { StarDisplay } from '../components/StarRating';
import { useStats } from '../hooks/useStats';
import { barBg } from '../utils/format';
import { CATEGORIES } from '../types';

export default function Dashboard() {
  const { stats, loading, error, reload } = useStats();
  const counterRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Animated counter
  const animateCounter = useCallback((el: HTMLElement, target: number, suffix: string) => {
    let start = 0;
    const duration = 1500;
    const isFloat = target % 1 !== 0;
    let startTime: number | null = null;

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * ease;
      el.textContent = (isFloat ? val.toFixed(1) : Math.round(val).toString()) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (!stats) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !e.target.getAttribute('data-counted')) {
            e.target.setAttribute('data-counted', '1');
            const txt = e.target.textContent || '';
            const num = parseFloat(txt);
            const suffix = txt.replace(/[\d.]/g, '');
            if (!isNaN(num)) animateCounter(e.target as HTMLElement, num, suffix);
          }
        });
      },
      { threshold: 0.5 }
    );
    counterRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [stats, animateCounter]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="skeleton h-3 w-24 mb-3" />
              <div className="skeleton h-8 w-16 mb-2" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-80 skeleton" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-80 skeleton" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4 block" />
        <h3 className="font-semibold mb-2">{error}</h3>
        <button onClick={reload} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
          <i className="fa-solid fa-rotate-right mr-2" />Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: 'Managers Reviewed', value: stats.managerCount.toString(), icon: 'fa-users', sub: 'Unique managers' },
    { label: 'Total Reviews', value: stats.reviewCount.toString(), icon: 'fa-shield-halved', sub: 'Anonymous' },
    { label: 'Companies', value: stats.companyCount.toString(), icon: 'fa-building', sub: 'Organizations' },
    { label: 'Would Recommend', value: stats.recommendPct + '%', icon: 'fa-thumbs-up', sub: 'Recommend' },
  ];

  const dist = stats.distribution;
  const maxDist = Math.max(...dist, 1);
  const distColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-primary', 'bg-green-500'];
  const distLabels = ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:-translate-y-0.5 hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1">{s.label}</p>
            <p
              className="text-2xl font-bold font-mono"
              ref={(el) => { if (el) counterRefs.current.set(s.label, el); }}
            >
              {s.value}
            </p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <i className={`fa-solid ${s.icon}`} /> {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Category Averages */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-sm mb-4">Average Rating by Category</h3>
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((cat) => {
              const val = stats.categoryAvgs[cat] || 0;
              return (
                <div key={cat} className="flex items-center gap-2 text-xs">
                  <span className="w-36 text-gray-500 truncate">{cat}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${barBg(val)}`} style={{ width: `${(val / 5) * 100}%` }} />
                  </div>
                  <span className="w-7 text-right font-mono font-semibold">{val.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-sm mb-4">Rating Distribution</h3>
          <div className="flex items-end gap-3 h-48 pt-2">
            {dist.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold">{count}</span>
                <div
                  className={`w-full rounded-t-lg min-h-[2px] transition-all duration-700 ${distColors[i]}`}
                  style={{ height: `${(count / maxDist) * 140}px` }}
                />
                <span className="text-[10px] text-gray-500">{distLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Managers */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-sm mb-4">Top Rated Managers</h3>
        <div className="flex flex-col gap-2">
          {stats.topManagers.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-40 text-gray-600 truncate font-medium">{m.name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barBg(m.avgRating)}`} style={{ width: `${(m.avgRating / 5) * 100}%` }} />
              </div>
              <span className="w-7 text-right font-mono font-semibold">{m.avgRating.toFixed(1)}</span>
              <StarDisplay rating={m.avgRating} size={10} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
