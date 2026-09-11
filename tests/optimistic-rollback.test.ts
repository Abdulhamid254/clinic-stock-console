import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api-client';
import { useCorrectStock } from '@/lib/queries/products';
import type { Product, ProductListResponse } from '@/lib/types';

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
});
