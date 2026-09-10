'use client';

import { Button } from '@/components/ui/button';
import { PAGE_SIZE } from '@/lib/schemas';

interface PaginationControlsProps {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ page, total, onPageChange }: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <nav className="flex items-center justify-between pt-2" aria-label="Pagination">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} &middot; {total} item{total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </nav>
  );
}
