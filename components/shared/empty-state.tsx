import { Button } from '@/components/ui/button';
import { PackageSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Distinguishes "no results for this search/filter" (pass onAction to offer
 * a way to clear filters) from a genuine "nothing here" case (omit it).
 */
export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 py-16 text-center">
      <PackageSearch className="h-10 w-10 text-slate-500" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
