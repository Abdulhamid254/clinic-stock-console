'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Thin wrapper around the native <dialog> element instead of a Radix
 * primitive. showModal()/close() give us focus-trapping, Esc-to-close
 * (fires 'cancel'), and returning focus to whatever triggered the dialog —
 * all built into the browser, no dependency required.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        // Click on the <dialog> backdrop itself (not its content) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'w-[90vw] max-w-md rounded-lg border border-slate-200 p-6 shadow-lg backdrop:bg-black/50',
        className,
      )}
    >
      <h2 id="dialog-title" className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
