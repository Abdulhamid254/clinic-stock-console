'use client';

import { useEffect, useState } from 'react';
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
 * Sets one stock value across every selected item. Same click-to-response
 * contract as the single-item StockCorrectionDialog (disable-while-pending,
 * can't dismiss mid-flight, typed value preserved on failure), with one
 * addition: failure here isn't all-or-nothing. DummyJSON fires N independent
 * PUTs, so some items can succeed while others fail. useBulkCorrectStock
 * already keeps the optimistic value for whichever items succeeded and
 * rolls back only the ones that didn't — this component's job is just to
 * report that split honestly rather than a blanket "it worked" or "it
 * failed". A full failure (every id failed) is reported the same way, just
 * with the count equal to the full selection.
 */
export function BulkCorrectionDialog({ ids, open, onOpenChange, onDone }: BulkCorrectionDialogProps) {
  const mutation = useBulkCorrectStock();
  const { showToast } = useToast();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockCorrectionValues>({ resolver: zodResolver(stockCorrectionSchema) });

  useEffect(() => {
    if (open) {
      reset();
      setFailureMessage(null);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omitting
    // `reset` and `mutation`: both are recreated every render by react-hook-form /
    // TanStack Query, so including them would re-run this on every render instead
    // of only when the dialog opens for a (possibly new) selection.
  }, [open]);

  function requestClose() {
    if (mutation.isPending) return;
    onOpenChange(false);
  }

  async function onSubmit(values: StockCorrectionValues) {
    setFailureMessage(null);
    try {
      const result = await mutation.mutateAsync({ ids, stock: values.stock });
      if (result.failedIds.length > 0) {
        const succeeded = ids.length - result.failedIds.length;
        setFailureMessage(
          succeeded > 0
            ? `${succeeded} of ${ids.length} items updated. ${result.failedIds.length} failed and ${result.failedIds.length === 1 ? 'has' : 'have'} been restored to its previous value — try again for just those, or retry the full selection.`
            : `All ${ids.length} updates failed. Previous values have been restored. Please try again.`,
        );
        showToast('Some items failed to update', 'error');
        return;
      }
      showToast(`Updated stock for ${ids.length} item${ids.length === 1 ? '' : 's'}`);
      reset();
      onOpenChange(false);
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save.';
      setFailureMessage(`${message} The previous values have been restored. Please try again.`);
      showToast(message, 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      title="Bulk correct stock count"
      description={`Set the same stock count for ${ids.length} selected item${ids.length === 1 ? '' : 's'}.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <fieldset disabled={mutation.isPending} className="space-y-4">
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

          {failureMessage && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {failureMessage}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : failureMessage ? 'Retry save' : `Apply to ${ids.length}`}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
