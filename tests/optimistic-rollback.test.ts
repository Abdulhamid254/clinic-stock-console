import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api-client';
import { useCorrectStock, useBulkCorrectStock } from '@/lib/queries/products';
import type { Product, ProductListResponse } from '@/lib/types';

/** Mirrors the shape ApiError carries in lib/api-client.ts (message + status). */
class FakeApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const product: Product = {
  id: 1,
  title: 'Bandages',
  description: 'test',
  category: 'medical',
  price: 5,
  stock: 40,
  thumbnail: '',
  images: [],
};

const listPage: ProductListResponse = {
  products: [product, { ...product, id: 2, title: 'Gauze', stock: 15 }],
  total: 2,
  skip: 0,
  limit: 12,
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('optimistic stock correction rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores the previous cached stock value when the mutation fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['product', '1'], product);

    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http 500'));

    const { result } = renderHook(() => useCorrectStock('1'), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ id: 1, stock: 5 });
    });

    // Optimistic update applies immediately, before the network call settles.
    await waitFor(() => {
      expect(client.getQueryData<Product>(['product', '1'])?.stock).toBe(5);
    });

    // Once the mutation fails, the previous value must be restored exactly.
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(client.getQueryData<Product>(['product', '1'])?.stock).toBe(40);
  });

  it('keeps the optimistic value once the mutation succeeds', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['product', '1'], product);

    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ...product, stock: 12 });

    const { result } = renderHook(() => useCorrectStock('1'), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ id: 1, stock: 12 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Product>(['product', '1'])?.stock).toBe(12);
  });

  it('also patches every cached stock-list page containing the item, not just the detail cache', async () => {
    // Regression test: correcting stock from the detail page must be visible
    // immediately if the user navigates back to /stock, without a refetch
    // (DummyJSON's PUT doesn't persist, so a refetch would just re-serve the
    // old value from the mock server).
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['product', '1'], product);
    client.setQueryData(
      ['products', { q: '', category: '', sortBy: 'title', order: 'asc', page: 1 }],
      listPage,
    );

    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ...product, stock: 10 });

    const { result } = renderHook(() => useCorrectStock('1'), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ id: 1, stock: 10 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedList = client.getQueryData<ProductListResponse>([
      'products',
      { q: '', category: '', sortBy: 'title', order: 'asc', page: 1 },
    ]);
    expect(cachedList?.products.find((p) => p.id === 1)?.stock).toBe(10);
    // The untouched second item in the same cached page must be unaffected.
    expect(cachedList?.products.find((p) => p.id === 2)?.stock).toBe(15);
  });

  it('rolls back the cached list page too if the mutation fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const listKey = ['products', { q: '', category: '', sortBy: 'title', order: 'asc', page: 1 }] as const;
    client.setQueryData(['product', '1'], product);
    client.setQueryData(listKey, listPage);

    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http 500'));

    const { result } = renderHook(() => useCorrectStock('1'), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ id: 1, stock: 999 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cachedList = client.getQueryData<ProductListResponse>(listKey as unknown as readonly unknown[]);
    expect(cachedList?.products.find((p) => p.id === 1)?.stock).toBe(40);
  });

  // "Test error path against http/500": the mock server can genuinely
  // return a 500, not just a network-level rejection. This exercises the
  // real error shape (ApiError with .status/.message, same as what
  // lib/api-client.ts throws for a non-ok response) end to end through the
  // mutation, confirming the rollback and the surfaced message both work
  // for a true server error, not just a generic thrown Error.
  it('rolls back and surfaces the real message on an HTTP 500 from the server', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['product', '1'], product);

    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new FakeApiError('Request failed with status 500', 500),
    );

    const { result } = renderHook(() => useCorrectStock('1'), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ id: 1, stock: 999 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(client.getQueryData<Product>(['product', '1'])?.stock).toBe(40);
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Request failed with status 500');
  });

  it('keeps a corrected value in cache indefinitely — no automatic revert on remount', async () => {
    // Regression test for the reported bug: stock reverted to its original
    // value "when refreshed" (navigating away and back, or just re-rendering
    // after enough time had passed). Root cause was a finite staleTime,
    // which let React Query's default refetchOnMount fire a background
    // refetch that re-served the mock server's never-actually-updated
    // value. useProduct/useProducts now use staleTime/gcTime: Infinity, so
    // once a query has data, nothing re-fetches it automatically — this
    // asserts that contract directly against the QueryClient defaults this
    // app actually uses (mirrors components/providers/query-provider.tsx),
    // rather than against a test-only override.
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
    client.setQueryData(['product', '1'], product);

    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ...product, stock: 7 });

    const { result, unmount } = renderHook(() => useCorrectStock('1'), { wrapper: wrapper(client) });
    act(() => {
      result.current.mutate({ id: 1, stock: 7 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Product>(['product', '1'])?.stock).toBe(7);
    unmount();

    // Simulate leaving the detail page and coming back later: mount a fresh
    // observer of the same query key, exactly like the item detail page
    // remounting after navigation. Because staleTime is Infinity on the
    // real hook (set in lib/queries/products.ts), and the cached data is
    // still present, this must NOT trigger another apiFetch call — if it
    // did, the mock "server" would hand back the un-mutated product and the
    // corrected value would silently disappear again.
    const { useProduct } = await import('@/lib/queries/products');
    (apiFetch as ReturnType<typeof vi.fn>).mockClear();
    const second = renderHook(() => useProduct('1'), { wrapper: wrapper(client) });
    await waitFor(() => expect(second.result.current.data?.stock).toBe(7));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('bulk correction rolls back only the items that failed, keeping the ones that succeeded', async () => {
    // Partial failure: id 1 succeeds, id 2 fails. Previously, useBulkCorrectStock's
    // mutationFn never threw for a partial failure (by design, to avoid an
    // all-or-nothing rollback), but nothing acted on failedIds either — a
    // failed item silently kept its optimistic value with no rollback and no
    // way for the UI to know. This asserts the fix: id 2 is restored to its
    // real prior stock (15) while id 1 keeps the new value (99).
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const listKey = ['products', { q: '', category: '', sortBy: 'title', order: 'asc', page: 1 }] as const;
    client.setQueryData(listKey, listPage);

    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('/products/2')) {
        return Promise.reject(new FakeApiError('Request failed with status 500', 500));
      }
      return Promise.resolve({ ...product, id: 1, stock: 99 });
    });

    const { result } = renderHook(() => useBulkCorrectStock(), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({ ids: [1, 2], stock: 99 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.failedIds).toEqual([2]);

    const cachedList = client.getQueryData<ProductListResponse>(listKey as unknown as readonly unknown[]);
    expect(cachedList?.products.find((p) => p.id === 1)?.stock).toBe(99);
    expect(cachedList?.products.find((p) => p.id === 2)?.stock).toBe(15);
  });
});
