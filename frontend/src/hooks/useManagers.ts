/* ========================================
   useManagers — Fetch & Search Managers
   ======================================== */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchManagers } from '../api/client';
import type { Manager } from '../types';

interface UseManagersOptions {
  q?: string;
  company?: string;
  minRating?: number;
  sort?: string;
  page?: number;
}

export function useManagers(opts: UseManagersOptions = {}) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagers({
        q: opts.q || undefined,
        company: opts.company || undefined,
        minRating: opts.minRating || undefined,
        sort: opts.sort || 'rating_desc',
        page: opts.page || 1,
        limit: 20,
      });
      setManagers(data.managers);
      setHasMore(data.pagination.hasMore);

      // Extract unique companies
      const allCompanies = new Set<string>();
      data.managers.forEach((m) =>
        m.companies.forEach((c) => allCompanies.add(c))
      );
      setCompanies(Array.from(allCompanies).sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load managers');
    } finally {
      setLoading(false);
    }
  }, [opts.q, opts.company, opts.minRating, opts.sort, opts.page]);

  useEffect(() => {
    // Debounce search queries (300ms) to avoid hammering the API
    if (opts.q !== undefined) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        load();
      }, 300);
      return () => clearTimeout(debounceRef.current);
    }
    // Non-search changes fire immediately
    load();
  }, [load, opts.q]);

  return { managers, loading, error, hasMore, companies, reload: load };
}
