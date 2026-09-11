import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api-client';
import { PAGE_SIZE } from '../schemas';
import type { Product, ProductListResponse, StockQueryParams } from '../types';

/**
 * DummyJSON does not support combining search + category + sort server-side
 * in a single call (see README limitation notes). We resolve the three
 * possible request shapes here, in priority order: a search term wins over a
 * category filter, and sorting is applied via query params on top of
 * whichever base list we fetched. Client-side re-sort is NOT needed because
 * DummyJSON's sortBy/order params work on all three endpoints.
 */
function buildProductsUrl(params: StockQueryParams): string {
  const skip = (params.page - 1) * PAGE_SIZE;
  const sortQs = `sortBy=${params.sortBy}&order=${params.order}`;
  const pageQs = `limit=${PAGE_SIZE}&skip=${skip}`;

  if (params.q) {
    return `/products/search?q=${encodeURIComponent(params.q)}&${pageQs}&${sortQs}`;
  }
  if (params.category) {
    return `/products/category/${encodeURIComponent(params.category)}?${pageQs}&${sortQs}`;
  }
  return `/products?${pageQs}&${sortQs}`;
}

export function productsQueryKey(params: StockQueryParams) {
  return ['products', params] as const;
}

export function useProducts(params: StockQueryParams) {
  return useQuery({
    queryKey: productsQueryKey(params),
    queryFn: () => apiFetch<ProductListResponse>(buildProductsUrl(params)),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Array<{ slug: string; name: string; url: string }>>('/products/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => apiFetch<Product>(`/products/${id}`),
    retry: (failureCount, error: unknown) => {
      // Don't retry a 404 — it's a real "not found", not a transient failure.
      const status = (error as { status?: number })?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

interface CorrectStockInput {
  id: number;
  stock: number;
}

/**
 * Optimistic stock correction. We update the cached product immediately so
 * the UI reflects the new count without waiting on the round trip, snapshot
 * the previous value(s) for rollback, and roll back on failure. DummyJSON's
 * PUT doesn't persist server-side (mock API limitation, documented in
 * README) — the optimistic cache update stands in as the "real" outcome for
 * the session.
 *
 * Crucially, this patches BOTH the single-item cache (['product', id], used
 * by the detail page) AND every cached stock-list page (['products', ...],
 * one entry per filter/sort/page combination) that happens to contain this
 * product. Patching only the detail cache was the original bug here: the
 * list is a separate cache entry, so a corrected value would show on the
 * detail page but silently revert to the old number the moment the user
 * navigated back to /stock, since that cached list snapshot was never
 * touched. We deliberately patch in place rather than invalidating/
 * refetching the list — since PUT doesn't persist, a refetch would just
 * pull the original, uncorrected value back from the mock server.
 */
export function useCorrectStock(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stock }: CorrectStockInput) =>
      apiFetch<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ stock }),
      }),
    onMutate: async ({ id: productId, stock }) => {
      await queryClient.cancelQueries({ queryKey: ['product', id] });
      await queryClient.cancelQueries({ queryKey: ['products'] });

      const previousProduct = queryClient.getQueryData<Product>(['product', id]);
      const previousLists = queryClient.getQueriesData<ProductListResponse>({ queryKey: ['products'] });

      if (previousProduct) {
        queryClient.setQueryData<Product>(['product', id], { ...previousProduct, stock });
      }

      queryClient.setQueriesData<ProductListResponse>({ queryKey: ['products'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          products: old.products.map((p) => (p.id === productId ? { ...p, stock } : p)),
        };
      });

      return { previousProduct, previousLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(['product', id], context.previousProduct);
      }
      context?.previousLists?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Product>(['product', id], (old) =>
        old ? { ...old, stock: data.stock ?? old.stock } : old,
      );
    },
  });
}

/**
 * Same idea as useCorrectStock, but applies one stock value to several
 * products in a single action (bulk correction). Each product's list-cache
 * entries and, if present, its own detail cache are patched together so the
 * table and any already-open detail pages agree immediately.
 */
export function useBulkCorrectStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, stock }: { ids: number[]; stock: number }) => {
      // DummyJSON has no bulk endpoint, so this is N individual PUTs. We
      // still treat it as one mutation/one optimistic update from the UI's
      // point of view, and report which ones actually failed.
      const results = await Promise.allSettled(
        ids.map((id) => apiFetch<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ stock }) })),
      );
      const failedIds = ids.filter((_, i) => results[i]!.status === 'rejected');
      return { failedIds };
    },
    onMutate: async ({ ids, stock }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const idSet = new Set(ids);

      const previousLists = queryClient.getQueriesData<ProductListResponse>({ queryKey: ['products'] });
      const previousProducts = ids.map(
        (id) => [String(id), queryClient.getQueryData<Product>(['product', String(id)])] as const,
      );

      queryClient.setQueriesData<ProductListResponse>({ queryKey: ['products'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          products: old.products.map((p) => (idSet.has(p.id) ? { ...p, stock } : p)),
        };
      });
      previousProducts.forEach(([idStr, previous]) => {
        if (previous) queryClient.setQueryData<Product>(['product', idStr], { ...previous, stock });
      });

      return { previousLists, previousProducts };
    },
    onError: (_err, _vars, context) => {
      context?.previousLists?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousProducts?.forEach(([idStr, previous]) => {
        if (previous) queryClient.setQueryData(['product', idStr], previous);
      });
    },
  });
}
