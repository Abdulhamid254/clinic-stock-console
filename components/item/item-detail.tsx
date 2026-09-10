'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StockCorrectionDialog } from './stock-correction-dialog';
import type { Product } from '@/lib/types';

interface ItemDetailProps {
  product: Product;
  returnTo: string;
}

export function ItemDetail({ product, returnTo }: ItemDetailProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Link href={returnTo} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to stock list
      </Link>

      <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-[240px_1fr]">
        <Image
          src={product.thumbnail}
          alt=""
          width={240}
          height={240}
          className="h-60 w-full rounded-lg object-cover sm:w-60"
          priority
        />
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold">{product.title}</h1>
            <p className="text-sm capitalize text-slate-500">{product.category}</p>
          </div>
          <p className="text-slate-600">{product.description}</p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <span className="text-xl font-semibold">${product.price.toFixed(2)}</span>
            <span className="text-sm">
              Current stock: <span className="font-medium">{product.stock}</span>
            </span>
          </div>
          <Button onClick={() => setDialogOpen(true)}>Correct stock count</Button>
        </div>
      </div>

      <StockCorrectionDialog product={product} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
