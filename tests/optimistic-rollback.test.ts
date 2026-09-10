import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api-client';
import { useCorrectStock } from '@/lib/queries/products';
import type { Product } from '@/lib/types';

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
});
