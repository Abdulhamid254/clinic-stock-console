import { PAGE_SIZE, SORT_FIELDS, SORT_ORDERS } from './schemas';
import type { SortField, SortOrder, StockQueryParams } from './types';

const DEFAULTS: StockQueryParams = {
  q: '',
  category: '',
  sortBy: 'title',
  order: 'asc',
  page: 1,
};

function isSortField(value: string | null): value is SortField {
  return !!value && (SORT_FIELDS as readonly string[]).includes(value);
}

function isSortOrder(value: string | null): value is SortOrder {
  return !!value && (SORT_ORDERS as readonly string[]).includes(value);
}

/** Parse a URLSearchParams-like object into typed, defaulted stock params. */
export function parseStockParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): StockQueryParams {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const v = params[key];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };

  const rawPage = Number(get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : DEFAULTS.page;

  const sortBy = get('sortBy');
  const order = get('order');

  return {
    q: get('q') ?? DEFAULTS.q,
    category: get('category') ?? DEFAULTS.category,
    sortBy: isSortField(sortBy) ? sortBy : DEFAULTS.sortBy,
    order: isSortOrder(order) ? order : DEFAULTS.order,
    page,
  };
}

/** Serialize stock params back to a query string, omitting default values. */
export function stockParamsToSearch(params: StockQueryParams): string {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.category) usp.set('category', params.category);
  if (params.sortBy !== DEFAULTS.sortBy) usp.set('sortBy', params.sortBy);
  if (params.order !== DEFAULTS.order) usp.set('order', params.order);
  if (params.page !== DEFAULTS.page) usp.set('page', String(params.page));
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export type StockParamPatch = Partial<StockQueryParams>;

/**
 * Apply a partial update to stock params, applying the one rule that keeps
 * users from getting stranded: changing q, category, sortBy, or order always
 * resets page back to 1. An explicit page change in the same patch (e.g. from
 * clicking "next") is respected and is NOT overridden back to 1.
 */
export function applyStockParamPatch(
  current: StockQueryParams,
  patch: StockParamPatch,
): StockQueryParams {
  const next = { ...current, ...patch };

  const filtersChanged =
    ('q' in patch && patch.q !== current.q) ||
    ('category' in patch && patch.category !== current.category) ||
    ('sortBy' in patch && patch.sortBy !== current.sortBy) ||
    ('order' in patch && patch.order !== current.order);

  if (filtersChanged && !('page' in patch)) {
    next.page = 1;
  }

  return next;
}

/**
 * Clamp a requested page against the actual total item count, so a shared
 * URL pointing past the end of a (possibly now-smaller) result set never
 * renders a blank table with no way out.
 */
export function clampPage(page: number, total: number, pageSize: number = PAGE_SIZE): number {
  if (total <= 0) return 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}
