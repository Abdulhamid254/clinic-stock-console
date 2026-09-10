'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StockTableProps {
  products: Product[];
  returnTo: string;
  isRefreshing?: boolean;
}

function stockBadge(stock: number) {
  if (stock === 0) return { label: 'Out of stock', className: 'bg-red-100 text-red-800' };
  if (stock <= 10) return { label: 'Low stock', className: 'bg-amber-100 text-amber-800' };
  return { label: 'In stock', className: 'bg-emerald-100 text-emerald-800' };
}

/**
 * Renders a real <table> at wider widths and a stacked card layout below
 * the sm breakpoint, per the 360px responsiveness requirement — a squeezed
 * table is not readable at that width.
 */
export function StockTable({ products, returnTo, isRefreshing }: StockTableProps) {
  return (
    <div className={cn('transition-opacity', isRefreshing && 'opacity-60')}>
      {/* Stacked card layout below sm */}
      <div className="grid gap-3 sm:hidden">
        {products.map((product) => {
          const badge = stockBadge(product.stock);
          return (
            <Link
              key={product.id}
              href={`/items/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
            >
              <Image
                src={product.thumbnail}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{product.title}</p>
                <p className="text-sm capitalize text-slate-500">{product.category}</p>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span>${product.price.toFixed(2)}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>
                    {badge.label} ({product.stock})
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Table layout at sm and up */}
      <div className="hidden overflow-auto rounded-lg border border-slate-200 sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="h-11 px-3"></th>
              <th className="h-11 px-3 font-medium">Title</th>
              <th className="h-11 px-3 font-medium">Category</th>
              <th className="h-11 px-3 font-medium">Price</th>
              <th className="h-11 px-3 font-medium">Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const badge = stockBadge(product.stock);
              return (
                <tr key={product.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="w-14 p-3">
                    <Image
                      src={product.thumbnail}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/items/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="font-medium hover:underline"
                    >
                      {product.title}
                    </Link>
                  </td>
                  <td className="p-3 capitalize text-slate-500">{product.category}</td>
                  <td className="p-3">${product.price.toFixed(2)}</td>
                  <td className="p-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>
                      {badge.label} ({product.stock})
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
