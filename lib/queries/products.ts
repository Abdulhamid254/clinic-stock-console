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
 * the previous value for rollback, and roll back on failure. DummyJSON's PUT
 * doesn't persist server-side (mock API limitation, documented in README) —
 * the optimistic cache update stands in as the "real" outcome for the
 * session.
 */
export function useCorrectStock(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stock }: CorrectStockInput) =>
      apiFetch<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ stock }),
      }),
    onMutate: async ({ stock }) => {
      await queryClient.cancelQueries({ queryKey: ['product', id] });
      const previous = queryClient.getQueryData<Product>(['product', id]);
      if (previous) {
        queryClient.setQueryData<Product>(['product', id], { ...previous, stock });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['product', id], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Product>(['product', id], (old) =>
        old ? { ...old, stock: data.stock ?? old.stock } : old,
      );
    },
  });
}
