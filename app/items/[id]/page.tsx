'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useProduct } from '@/lib/queries/products';
import { ItemDetail } from '@/components/item/item-detail';
import { LoadingState } from '@/components/shared/loading-state';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ApiError } from '@/lib/api-client';

function ItemPageInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/stock';

  const { data: product, isLoading, isError, error, refetch } = useProduct(params.id);

  const isNotFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      {isLoading ? (
        <LoadingState rows={4} label="Loading item" />
      ) : isNotFound ? (
        <EmptyState
          title="Item not found"
          description="This item may have been removed."
          actionLabel="Back to stock list"
          onAction={() => {
            window.location.href = returnTo;
          }}
        />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      ) : product ? (
        <ItemDetail product={product} returnTo={returnTo} />
      ) : null}
    </div>
  );
}

export default function ItemPage() {
  return (
    <Suspense fallback={<div className="p-8"><LoadingState rows={4} /></div>}>
      <ItemPageInner />
    </Suspense>
  );
}
