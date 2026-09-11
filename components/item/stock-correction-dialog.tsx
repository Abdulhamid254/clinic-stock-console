'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { stockCorrectionSchema, type StockCorrectionValues } from '@/lib/schemas';
import { useCorrectStock } from '@/lib/queries/products';
import type { Product } from '@/lib/types';

interface StockCorrectionDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Click-to-response contract for this dialog:
 *  - Click Save -> button reads "Saving…" and disables, the whole form
 *    (including Cancel and the input) disables too, so the mutation can't
 *    be dismissed or re-submitted mid-flight. The stock value elsewhere in
 *    the app (table row, detail header) updates immediately via the
 *    optimistic cache patch in useCorrectStock — the user doesn't wait on
 *    the network to see their change.
 *  - Success -> toast confirmation, dialog closes. The optimistic value
 *    stands as-is (it's already what the server echoed back).
 *  - Failure -> the optimistic cache patch is rolled back automatically
 *    (useCorrectStock's onError), so the stock shown everywhere else in the
 *    app reverts to the real prior value. This dialog itself stays open
 *    with whatever the user typed still in the field (so retrying doesn't
 *    mean retyping), shows the actual error inline, and the Save button
 *    becomes "Retry save". An error toast fires too, in case the dialog is
 *    ever reached from a state where the inline message isn't visible.
 */
export function StockCorrectionDialog({ product, open, onOpenChange }: StockCorrectionDialogProps) {
  const mutation = useCorrectStock(String(product.id));
  const { showToast } = useToast();

  function requestClose() {
    // Ignore Esc / backdrop click / Cancel while a save is in flight, so the
    // user can't dismiss the dialog out from under a pending mutation and
    // lose track of whether it succeeded or failed.
    if (mutation.isPending) return;
    onOpenChange(false);
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockCorrectionValues>({
    resolver: zodResolver(stockCorrectionSchema),
    defaultValues: { stock: product.stock },
  });

  useEffect(() => {
    if (open) {
      reset({ stock: product.stock });
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omitting
    // `reset` and `mutation`: both are recreated every render by react-hook-form /
    // TanStack Query, so including them would re-run this on every render instead
    // of only when the dialog opens or the underlying product's stock changes.
  }, [open, product.stock]);

  async function onSubmit(values: StockCorrectionValues) {
    try {
      await mutation.mutateAsync({ id: product.id, stock: values.stock });
      showToast('Stock count updated');
      onOpenChange(false);
    } catch (err) {
      // Cache rollback already happened inside useCorrectStock's onError.
      // Here we just surface it: inline message stays with the dialog,
      // toast covers the case where the dialog isn't on screen for some
      // reason (e.g. a future "quick edit" entry point reusing this hook).
      const message = err instanceof Error ? err.message : 'Could not save the new stock count.';
      showToast(message, 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      title="Correct stock count"
      description={`Update the current stock level for ${product.title}.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="stock" className="text-sm font-medium">
              New stock count
            </label>
            <Input
              id="stock"
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
              {mutation.error instanceof Error ? mutation.error.message : 'Could not save the new stock count.'} The
              previous value has been restored on screen — please try again.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : mutation.isError ? 'Retry save' : 'Save'}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
