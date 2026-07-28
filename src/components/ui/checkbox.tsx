import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, ...props }, ref) => {
    const isControlled = checked !== undefined;
    return (
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={isControlled ? checked : undefined}
          defaultChecked={isControlled ? undefined : defaultChecked}
          className={cn(
            'peer h-5 w-5 cursor-pointer appearance-none rounded border border-ink-rule bg-surface transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <Check
          className="pointer-events-none absolute left-0 top-0 h-5 w-5 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden
        />
      </span>
    );
  },
);
Checkbox.displayName = 'Checkbox';
