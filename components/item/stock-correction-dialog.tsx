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
 * Decision: the Save button is disabled (not spinner-while-clickable) during
 * the mutation, matching the pending-state pattern used on the login form.
 * On failure we keep the dialog open and the field populated with what the
 * user typed, roll back the optimistic cache value, and show the error
 * inline with a retry action.
 */
export function StockCorrectionDialog({ product, open, onOpenChange }: StockCorrectionDialogProps) {
  const mutation = useCorrectStock(String(product.id));
  const { showToast } = useToast();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.stock]);

  async function onSubmit(values: StockCorrectionValues) {
    try {
      await mutation.mutateAsync({ id: product.id, stock: values.stock });
      showToast('Stock count updated');
      onOpenChange(false);
    } catch {
      // Error is shown inline below; dialog stays open, value stays as typed.
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Correct stock count"
      description={`Update the current stock level for ${product.title}.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            Could not save the new stock count. The previous value has been restored on screen.
            Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : mutation.isError ? 'Retry save' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
