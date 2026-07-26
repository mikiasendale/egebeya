import * as React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'secondary' | 'destructive' | 'outline';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'border border-transparent bg-[#1E3A8A]/10 text-[#1E3A8A]',
  success: 'border border-transparent bg-green-100 text-green-800',
  secondary: 'border border-transparent bg-gray-100 text-gray-800',
  destructive: 'border border-transparent bg-red-100 text-red-800',
  outline: 'border border-gray-300 text-gray-700',
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
