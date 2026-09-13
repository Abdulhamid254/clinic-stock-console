import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
          'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-500',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
