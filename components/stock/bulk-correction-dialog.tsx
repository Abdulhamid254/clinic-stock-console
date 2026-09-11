'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { stockCorrectionSchema, type StockCorrectionValues } from '@/lib/schemas';
import { useBulkCorrectStock } from '@/lib/queries/products';

interface BulkCorrectionDialogProps {
  ids: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Sets one stock value across every selected item. Same pending/rollback
 * pattern as the single-item StockCorrectionDialog: disabled Save button
 * while pending, dialog stays open with the typed value on failure, and the
 * optimistic cache patch (see useBulkCorrectStock) is rolled back in full if
 * any of the underlying PUTs fail.
 */
export function BulkCorrectionDialog({ ids, open, onOpenChange, onDone }: BulkCorrectionDialogProps) {
  const mutation = useBulkCorrectStock();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockCorrectionValues>({ resolver: zodResolver(stockCorrectionSchema) });

  async function onSubmit(values: StockCorrectionValues) {
    try {
      await mutation.mutateAsync({ ids, stock: values.stock });
      showToast(`Updated stock for ${ids.length} item${ids.length === 1 ? '' : 's'}`);
      reset();
      onOpenChange(false);
      onDone();
    } catch {
      // Error shown inline below; dialog stays open, value stays as typed.
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Bulk correct stock count"
      description={`Set the same stock count for ${ids.length} selected item${ids.length === 1 ? '' : 's'}.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="bulk-stock" className="text-sm font-medium">
            New stock count
          </label>
          <Input
            id="bulk-stock"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            aria-invalid={!!errors.stock}
            {...register('stock')}
          />
          {errors.stock && (
            <p role="alert" className="text-sm text-red-600">
              {errors.stock.message}
            </p>
          )}
        </div>

        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : 'Could not save.'} The
            previous values have been restored. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : mutation.isError ? 'Retry save' : `Apply to ${ids.length}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
