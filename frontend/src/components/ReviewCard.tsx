/* ========================================
   ReviewCard — Single review display
   (with verification badge)
   ======================================== */

import { useState } from 'react';
import { StarDisplay } from './StarRating';
import { showToast } from './Toast';
import { toggleHelpful, reportReview } from '../api/client';
import { formatDate } from '../utils/format';
import type { Review } from '../types';

interface ReviewCardProps {
  review: Review;
  onUpdate?: () => void;
}

export default function ReviewCard({ review, onUpdate }: ReviewCardProps) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const avgRating =
    Object.values(review.ratings).reduce((a, b) => a + b, 0) /
    Object.values(review.ratings).length;

  const handleHelpful = async () => {
    try {
      const result = await toggleHelpful(review.id);
      setHelpfulCount(result.helpfulCount);
      setVoted(result.voted);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to vote', 'error');
    }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      await reportReview(review.id, reportReason);
      showToast('Report submitted. Thank you!', 'success');
      setReporting(false);
      setReportReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to report', 'error');
    }
  };

  return (
    <div className="p-5 border-b border-gray-100 last:border-b-0 hover:bg-blue-50/30 transition-colors">
      {/* Meta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StarDisplay rating={avgRating} />
          <span className="font-bold text-sm font-mono">{avgRating.toFixed(1)}</span>
          {review.recommends && (
            <span className="ml-2 text-green-600 text-xs font-semibold">
              <i className="fa-solid fa-thumbs-up mr-1" />
              Recommends
            </span>
          )}

          {/* Verification Badge */}
          {review.verified ? (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
              <i className="fa-solid fa-circle-check" />
              Verified Employee
            </span>
          ) : (
            <span className="ml-2 text-[10px] text-gray-400 font-medium">
              Unverified
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
      </div>

      {/* Pros */}
      {review.pros && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">
            <i className="fa-solid fa-circle-check mr-1" />
            Pros
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">{review.pros}</p>
        </div>
      )}

      {/* Cons */}
      {review.cons && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-1">
            <i className="fa-solid fa-circle-xmark mr-1" />
            Cons
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">{review.cons}</p>
        </div>
      )}

      {/* Advice */}
      {review.advice && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">
            <i className="fa-solid fa-lightbulb mr-1" />
            Advice to Management
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">{review.advice}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleHelpful}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-all ${
            voted
              ? 'border-primary text-primary bg-primary-light'
              : 'border-gray-300 text-gray-500 hover:border-primary hover:text-primary'
          }`}
        >
          <i className="fa-regular fa-thumbs-up" />
          Helpful ({helpfulCount})
        </button>

        {!reporting ? (
          <button
            onClick={() => setReporting(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <i className="fa-regular fa-flag mr-1" />
            Report
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-primary"
            >
              <option value="">Select reason...</option>
              <option value="spam">Spam</option>
              <option value="fake">Fake review</option>
              <option value="defamatory">Defamatory</option>
              <option value="inappropriate">Inappropriate</option>
            </select>
            <button
              onClick={handleReport}
              disabled={!reportReason}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded-md disabled:opacity-50"
            >
              Submit
            </button>
            <button
              onClick={() => { setReporting(false); setReportReason(''); }}
              className="text-xs text-gray-400"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
