import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shared loading treatment. `rows` controls how many skeleton rows/cards to
 * render, so list and detail screens can reuse this without inventing their
 * own shimmer.
 */
export function LoadingState({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
