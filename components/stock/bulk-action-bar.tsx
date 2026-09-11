import { Button } from '@/components/ui/button';

interface BulkActionBarProps {
  count: number;
  onCorrect: () => void;
  onClear: () => void;
}

/** Appears only once at least one row is selected; otherwise renders nothing. */
export function BulkActionBar({ count, onCorrect, onClear }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
      <span>
        {count} item{count === 1 ? '' : 's'} selected
      </span>
      <div className="flex gap-2">
        <Button variant="outline" className="h-8 px-3 text-xs" onClick={onClear}>
          Clear
        </Button>
        <Button className="h-8 px-3 text-xs" onClick={onCorrect}>
          Correct stock…
        </Button>
      </div>
    </div>
  );
}
