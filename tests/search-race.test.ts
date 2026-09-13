import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api-client';
import { useProducts } from '@/lib/queries/products';
import type { StockQueryParams } from '@/lib/types';

const baseParams: StockQueryParams = {
  q: '',
  category: '',
  sortBy: 'title',
  order: 'asc',
  page: 1,
};

function wrapper(client: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = 'QueryClientTestWrapper';
  return Wrapper;
}

describe('search race condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never lets an earlier, slower query response overwrite a later, faster one', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Query for "first" resolves slowly (simulating ?delay=2000), query for
    // "second" resolves immediately (simulating ?delay=0) — the exact
    // ordering the brief calls out as what breaks naive implementations.
    (apiFetch as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('q=first')) {
        return new Promise((resolve) =>
          setTimeout(
            () => resolve({ products: [{ id: 1, title: 'FIRST-RESULT' }], total: 1 }),
            100,
          ),
        );
      }
      if (path.includes('q=second')) {
        return Promise.resolve({ products: [{ id: 2, title: 'SECOND-RESULT' }], total: 1 });
      }
      return Promise.resolve({ products: [], total: 0 });
    });

    const { result, rerender } = renderHook(({ params }) => useProducts(params), {
      wrapper: wrapper(client),
      initialProps: { params: { ...baseParams, q: 'first' } },
    });

    // Immediately replace the query before the slow "first" response lands —
    // this is the user typing, then replacing what they typed.
    rerender({ params: { ...baseParams, q: 'second' } });

    await waitFor(() => {
      expect(result.current.data?.products[0]?.title).toBe('SECOND-RESULT');
    });

    // Give the slow "first" response time to resolve in the background, then
    // confirm it never clobbers the screen afterward either.
    await new Promise((r) => setTimeout(r, 150));
    expect(result.current.data?.products[0]?.title).toBe('SECOND-RESULT');
  });
});
