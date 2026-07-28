import * as React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'secondary' | 'destructive' | 'outline';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'border border-transparent bg-primary/10 text-primary',
  success: 'border border-transparent bg-success/10 text-success-deep',
  secondary: 'border border-transparent bg-surface-raised text-ink-soft',
  destructive: 'border border-transparent bg-accent/10 text-accent',
  outline: 'border border-ink-rule text-ink',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
