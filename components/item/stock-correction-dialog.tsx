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

export function StockCorrectionDialog({ product, open, onOpenChange }: StockCorrectionDialogProps) {
  const mutation = useCorrectStock(String(product.id));
  const { showToast } = useToast();

  function requestClose() {
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
  }, [open, product.stock]);

  async function onSubmit(values: StockCorrectionValues) {
    try {
      await mutation.mutateAsync({ id: product.id, stock: values.stock });
      showToast('Stock count updated');
      onOpenChange(false);
    } catch (err) {
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
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Could not save the new stock count.'}{' '}
              The previous value has been restored on screen — please try again.
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
