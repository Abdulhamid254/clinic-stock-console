'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FiltersBar } from '@/components/stock/filters-bar';
import { StockTable } from '@/components/stock/stock-table';
import { PaginationControls } from '@/components/stock/pagination-controls';
import { BulkActionBar } from '@/components/stock/bulk-action-bar';
import { BulkCorrectionDialog } from '@/components/stock/bulk-correction-dialog';
import { LoadingState } from '@/components/shared/loading-state';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { useProducts } from '@/lib/queries/products';
import {
  applyStockParamPatch,
  clampPage,
  parseStockParams,
  stockParamsToSearch,
} from '@/lib/url-state';
import type { StockQueryParams } from '@/lib/types';

function StockPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = parseStockParams(searchParams);
  const { data, isLoading, isFetching, isError, error, refetch } = useProducts(params);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [params.q, params.category, params.sortBy, params.order, params.page]);

  const updateParams = useCallback(
    (patch: Partial<StockQueryParams>) => {
      if ('q' in patch && patch.q) patch.category = '';
      if ('category' in patch && patch.category) patch.q = '';

      const next = applyStockParamPatch(params, patch);
      router.push(`${pathname}${stockParamsToSearch(next)}`);
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (!data) return;
    const clamped = clampPage(params.page, data.total);
    if (clamped !== params.page) {
      updateParams({ page: clamped });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omitting
  }, [data, params.page]);

  const currentUrl = `${pathname}${stockParamsToSearch(params)}`;
  const hasActiveFilters = !!(params.q || params.category);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    const pageIds = data.products.map((p) => p.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(pageIds));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="text-sm text-slate-500">Search, filter, and correct ward stock counts.</p>
      </header>

      <FiltersBar params={params} onChange={updateParams} />

      {isLoading ? (
        <LoadingState rows={6} label="Loading stock list" />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      ) : !data || data.products.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'No items match your filters' : 'No stock items found'}
          description={
            hasActiveFilters ? 'Try a different search term or clear your filters.' : undefined
          }
          actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
          onAction={hasActiveFilters ? () => updateParams({ q: '', category: '' }) : undefined}
        />
      ) : (
        <>
          <BulkActionBar
            count={selectedIds.size}
            onCorrect={() => setBulkDialogOpen(true)}
            onClear={() => setSelectedIds(new Set())}
          />
          <StockTable
            products={data.products}
            returnTo={currentUrl}
            isRefreshing={isFetching}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
          <PaginationControls
            page={params.page}
            total={data.total}
            onPageChange={(page) => updateParams({ page })}
          />
          <BulkCorrectionDialog
            ids={Array.from(selectedIds)}
            open={bulkDialogOpen}
            onOpenChange={setBulkDialogOpen}
            onDone={() => setSelectedIds(new Set())}
          />
        </>
      )}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <LoadingState rows={6} />
        </div>
      }
    >
      <StockPageInner />
    </Suspense>
  );
}
