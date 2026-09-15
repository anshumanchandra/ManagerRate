/* ========================================
   ManagerCard — Manager grid card
   ======================================== */

import { Link } from 'react-router-dom';
import { StarDisplay } from './StarRating';
import { getInitials, avatarColor, barBg } from '../utils/format';
import type { Manager } from '../types';

interface ManagerCardProps {
  manager: Manager;
  index: number;
}

export default function ManagerCard({ manager, index }: ManagerCardProps) {
  const topCats = Object.entries(manager.categoryAvgs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <Link
      to={`/managers/${manager.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base ${avatarColor(index)}`}
        >
          {getInitials(manager.name)}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-base truncate">{manager.name}</h3>
          <p className="text-xs text-primary truncate">
            <i className="fa-solid fa-building mr-1" />
            {manager.companies.join(', ')}
          </p>
          {manager.linkedinUrl && (
            <span className="text-[11px] text-primary/70">
              <i className="fa-brands fa-linkedin mr-1" />
              LinkedIn Profile
            </span>
          )}
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl font-bold font-mono">{manager.avgRating.toFixed(1)}</span>
        <div>
          <StarDisplay rating={manager.avgRating} />
          <p className="text-[11px] text-gray-500 mt-0.5">
            {manager.reviewCount} review{manager.reviewCount !== 1 ? 's' : ''} &middot;{' '}
            {manager.recommendPct}% recommend
          </p>
        </div>
      </div>

      {/* Top categories */}
      <div className="flex flex-col gap-1.5">
        {topCats.map(([cat, val]) => (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className="w-32 text-gray-500 truncate">{cat}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barBg(val)}`}
                style={{ width: `${(val / 5) * 100}%` }}
              />
            </div>
            <span className="w-7 text-right font-mono font-semibold text-[11px]">
              {val.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}
