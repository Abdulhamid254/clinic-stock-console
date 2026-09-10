import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
}

/** Shared error treatment: every data-fetching screen uses this with refetch() as onRetry. */
export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="space-y-2">
          <p className="font-medium text-red-800">{title}</p>
          <p className="text-sm text-red-700">
            {message ?? 'The request failed. Check your connection and try again.'}
          </p>
          <Button variant="outline" onClick={onRetry} className="h-8 px-3 text-xs">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
