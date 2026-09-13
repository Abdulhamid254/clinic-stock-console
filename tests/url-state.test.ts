import { describe, it, expect } from 'vitest';
import {
  applyStockParamPatch,
  clampPage,
  parseStockParams,
  stockParamsToSearch,
} from '@/lib/url-state';
import type { StockQueryParams } from '@/lib/types';

const base: StockQueryParams = { q: '', category: '', sortBy: 'title', order: 'asc', page: 1 };

describe('applyStockParamPatch', () => {
  it('resets page to 1 when the category changes', () => {
    const current = { ...base, page: 6 };
    const next = applyStockParamPatch(current, { category: 'beauty' });
    expect(next.page).toBe(1);
    expect(next.category).toBe('beauty');
  });

  it('resets page to 1 when the search term changes', () => {
    const current = { ...base, page: 4 };
    const next = applyStockParamPatch(current, { q: 'phone' });
    expect(next.page).toBe(1);
  });

  it('resets page to 1 when sort changes', () => {
    const current = { ...base, page: 3, sortBy: 'title' as const };
    const next = applyStockParamPatch(current, { sortBy: 'price' });
    expect(next.page).toBe(1);
  });

  it('does not reset page when only page itself changes', () => {
    const current = { ...base, page: 2 };
    const next = applyStockParamPatch(current, { page: 3 });
    expect(next.page).toBe(3);
  });

  it('respects an explicit page value even alongside a filter change', () => {
    const current = { ...base, page: 5 };
    const next = applyStockParamPatch(current, { category: 'beauty', page: 2 });
    expect(next.page).toBe(2);
  });

  it('does not reset page when the patch sets a filter to its current value', () => {
    const current = { ...base, category: 'beauty', page: 4 };
    const next = applyStockParamPatch(current, { category: 'beauty' });
    expect(next.page).toBe(4);
  });
});

describe('clampPage', () => {
  it('clamps a page value that is beyond the total result set', () => {
    // 5 items at 12 per page = 1 total page; a shared URL requesting page 6 must clamp to 1.
    expect(clampPage(6, 5, 12)).toBe(1);
  });

  it('leaves an in-range page untouched', () => {
    expect(clampPage(2, 30, 12)).toBe(2);
  });

  it('never returns less than page 1, even for a zero total', () => {
    expect(clampPage(3, 0, 12)).toBe(1);
  });

  it('clamps a page below 1 up to 1', () => {
    expect(clampPage(0, 30, 12)).toBe(1);
  });
});

describe('parse/serialize round-trip', () => {
  it('restores the exact same params from a serialized search string', () => {
    const params: StockQueryParams = {
      q: 'phone',
      category: '',
      sortBy: 'price',
      order: 'desc',
      page: 3,
    };
    const search = stockParamsToSearch(params);
    const restored = parseStockParams(new URLSearchParams(search));
    expect(restored).toEqual(params);
  });

  it('falls back to defaults for missing or invalid params', () => {
    const restored = parseStockParams(new URLSearchParams('sortBy=bogus&page=-1'));
    expect(restored.sortBy).toBe('title');
    expect(restored.page).toBe(1);
  });
});
