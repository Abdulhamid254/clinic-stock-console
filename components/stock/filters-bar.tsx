'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCategories } from '@/lib/queries/products';
import type { StockQueryParams } from '@/lib/types';

interface FiltersBarProps {
  params: StockQueryParams;
  onChange: (patch: Partial<StockQueryParams>) => void;
}

const SORT_OPTIONS: Array<{ value: string; label: string; sortBy: 'title' | 'price' | 'stock'; order: 'asc' | 'desc' }> = [
  { value: 'title-asc', label: 'Title (A–Z)', sortBy: 'title', order: 'asc' },
  { value: 'title-desc', label: 'Title (Z–A)', sortBy: 'title', order: 'desc' },
  { value: 'price-asc', label: 'Price (low–high)', sortBy: 'price', order: 'asc' },
  { value: 'price-desc', label: 'Price (high–low)', sortBy: 'price', order: 'desc' },
  { value: 'stock-asc', label: 'Stock (low–high)', sortBy: 'stock', order: 'asc' },
  { value: 'stock-desc', label: 'Stock (high–low)', sortBy: 'stock', order: 'desc' },
];

/**
 * The search input is locally debounced (~350ms) before it's pushed to the
 * URL. TanStack Query's query-key cancellation (keyed on the full params
 * object) is what actually prevents a stale, slower response from a
 * replaced query ever overwriting the screen — this debounce just keeps the
 * request volume sane.
 */
export function FiltersBar({ params, onChange }: FiltersBarProps) {
  const [searchDraft, setSearchDraft] = useState(params.q);
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useCategories();

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  useEffect(() => {
    if (searchDraft === params.q) return;
    const handle = setTimeout(() => onChange({ q: searchDraft }), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-running
    // only on searchDraft: including `params.q` here would fire the debounce timer
    // on every external URL change too, not just local typing.
  }, [searchDraft]);

  const currentSortValue = `${params.sortBy}-${params.order}`;

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_200px_220px]">
      <div className="space-y-1.5">
        <label htmlFor="stock-search" className="text-sm font-medium">
          Search
        </label>
        <Input
          id="stock-search"
          placeholder="Search items…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="stock-category" className="text-sm font-medium">
          Category
        </label>
        <Select
          id="stock-category"
          value={params.category || 'all'}
          disabled={categoriesLoading}
          onChange={(e) => onChange({ category: e.target.value === 'all' ? '' : e.target.value })}
        >
          <option value="all">{categoriesLoading ? 'Loading categories…' : 'All categories'}</option>
          {categories?.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </Select>
        {categoriesError && (
          <button
            type="button"
            onClick={() => refetchCategories()}
            className="text-xs font-medium text-red-600 underline underline-offset-2"
          >
            Could not load categories. Retry.
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="stock-sort" className="text-sm font-medium">
          Sort by
        </label>
        <Select
          id="stock-sort"
          value={currentSortValue}
          onChange={(e) => {
            const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
            if (opt) onChange({ sortBy: opt.sortBy, order: opt.order });
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
