/* ========================================
   Managers — Searchable Manager Grid
   ======================================== */

import { useState, useEffect } from 'react';
import { useManagers } from '../hooks/useManagers';
import ManagerCard from '../components/ManagerCard';

interface ManagersProps {
  searchQuery: string;
}

export default function Managers({ searchQuery }: ManagersProps) {
  const [company, setCompany] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('rating_desc');

  const { managers, loading, error, companies, reload } = useManagers({
    q: searchQuery,
    company: company || undefined,
    minRating: minRating || undefined,
    sort,
  });

  // Reset filters when search changes
  useEffect(() => {
    if (searchQuery) {
      setCompany('');
      setMinRating(0);
    }
  }, [searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:border-primary"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={minRating}
          onChange={(e) => setMinRating(parseFloat(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:border-primary"
        >
          <option value={0}>All Ratings</option>
          <option value={4}>4+ Stars</option>
          <option value={3}>3+ Stars</option>
          <option value={2}>2+ Stars</option>
        </select>

        <button
          onClick={() => setSort(sort === 'rating_desc' ? 'rating_asc' : 'rating_desc')}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white hover:border-primary hover:text-primary transition-colors"
        >
          <i className={`fa-solid ${sort === 'rating_desc' ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'}`} />
          {sort === 'rating_desc' ? 'Highest Rated' : 'Lowest Rated'}
        </button>

        {searchQuery && (
          <span className="text-xs text-gray-500">
            Searching: "<span className="font-semibold">{searchQuery}</span>"
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton w-12 h-12 rounded-full" />
                <div>
                  <div className="skeleton h-4 w-28 mb-1" />
                  <div className="skeleton h-3 w-36" />
                </div>
              </div>
              <div className="skeleton h-6 w-16 mb-2" />
              <div className="skeleton h-3 w-full mb-1" />
              <div className="skeleton h-3 w-full mb-1" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-16">
          <i className="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4 block" />
          <h3 className="font-semibold mb-2">{error}</h3>
          <button onClick={reload} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <i className="fa-solid fa-rotate-right mr-2" />Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && managers.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <i className="fa-solid fa-users-slash text-4xl opacity-40 mb-4 block" />
          <h3 className="font-semibold text-gray-600 mb-1">No managers found</h3>
          <p className="text-sm">Try adjusting your filters or write a review to add a manager.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && managers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {managers.map((m, i) => (
            <ManagerCard key={m.id} manager={m} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
