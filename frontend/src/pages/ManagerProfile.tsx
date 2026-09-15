/* ========================================
   ManagerProfile — Full profile + reviews
   ======================================== */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchManager } from '../api/client';
import { StarDisplay } from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import { getInitials, avatarColor, barBg } from '../utils/format';
import { CATEGORIES } from '../types';
import type { ManagerProfile as ManagerProfileType } from '../types';

interface ManagerProfileProps {
  onWriteReview: (name?: string, linkedin?: string) => void;
}

export default function ManagerProfile({ onWriteReview }: ManagerProfileProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [manager, setManager] = useState<ManagerProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManager(id);
      setManager(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="skeleton h-4 w-32 mb-5" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="skeleton w-16 h-16 rounded-full" />
            <div>
              <div className="skeleton h-5 w-40 mb-2" />
              <div className="skeleton h-3 w-56 mb-1" />
              <div className="skeleton h-3 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-3 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <i className="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4 block" />
        <h3 className="font-semibold mb-2">{error}</h3>
        <button onClick={load} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
          <i className="fa-solid fa-rotate-right mr-2" />Retry
        </button>
      </div>
    );
  }

  if (!manager) return null;

  const rcColor = manager.recommendPct >= 70 ? 'text-green-600' : manager.recommendPct >= 50 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Back */}
      <button
        onClick={() => navigate('/managers')}
        className="inline-flex items-center gap-1.5 text-sm text-primary font-medium mb-5 hover:underline"
      >
        <i className="fa-solid fa-arrow-left" /> Back to Managers
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${avatarColor(0)}`}>
              {getInitials(manager.name)}
            </div>
            <div>
              <h2 className="text-xl font-bold">{manager.name}</h2>
              <p className="text-sm text-gray-500">
                <i className="fa-solid fa-building mr-1" />
                {manager.companies.join(', ')}
              </p>
              {manager.linkedinUrl && (
                <a
                  href={manager.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  <i className="fa-brands fa-linkedin" /> View LinkedIn Profile
                </a>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {manager.reviewCount} review{manager.reviewCount !== 1 ? 's' : ''} &middot;{' '}
                <span className={rcColor}>{manager.recommendPct}% recommend</span>
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <span className="text-4xl font-bold font-mono">{manager.avgRating.toFixed(1)}</span>
            <div className="mt-1"><StarDisplay rating={manager.avgRating} size={16} /></div>
            <p className="text-[11px] text-gray-400 mt-1">Overall</p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 pt-5 border-t border-gray-100">
          {CATEGORIES.map((cat) => {
            const val = manager.categoryAvgs[cat] || 0;
            return (
              <div key={cat} className="flex items-center gap-2 text-xs">
                <span className="w-36 text-gray-500 truncate">{cat}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barBg(val)}`} style={{ width: `${(val / 5) * 100}%` }} />
                </div>
                <span className="w-7 text-right font-mono font-semibold">{val.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          {manager.reviewCount} Review{manager.reviewCount !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={() => onWriteReview(manager.name, manager.linkedinUrl)}
          className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition inline-flex items-center gap-2"
        >
          <i className="fa-solid fa-pen" /> Write a Review
        </button>
      </div>

      {/* Reviews grouped by company */}
      {Object.entries(manager.reviewsByCompany).map(([companyName, reviews]) => (
        <div key={companyName} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          {/* Company header */}
          <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100 flex items-center gap-2">
            <i className="fa-solid fa-building text-primary" />
            <h4 className="font-semibold text-sm">{companyName}</h4>
            <span className="text-xs text-gray-400 ml-auto">
              {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Review list */}
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onUpdate={load} />
          ))}
        </div>
      ))}

      {/* Empty state */}
      {manager.reviewCount === 0 && (
        <div className="text-center py-12 text-gray-500">
          <i className="fa-solid fa-message text-4xl opacity-40 mb-4 block" />
          <h3 className="font-semibold text-gray-600 mb-1">No reviews yet</h3>
          <p className="text-sm">Be the first to review this manager!</p>
        </div>
      )}
    </div>
  );
}
