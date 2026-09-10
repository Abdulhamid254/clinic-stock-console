import { cn } from '@/lib/utils';

/**
 * Plain native <select>. Deliberately not a hand-rolled Radix-style listbox:
 * native selects already have correct keyboard/screen-reader behaviour on
 * every platform, and re-implementing that ourselves would be more code and
 * more risk for no real visual gain in this app.
 */
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
        className,
      )}
      {...props}
    />
  );
}
