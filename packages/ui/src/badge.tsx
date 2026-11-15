import * as React from 'react';
import { cn } from './utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    default: 'border-transparent bg-stone-900 text-stone-50 hover:bg-stone-800',
    success: 'border-transparent bg-emerald-100 text-emerald-800',
    warning: 'border-transparent bg-amber-100 text-amber-800',
    destructive: 'border-transparent bg-red-100 text-red-800',
    outline: 'text-stone-950 border-stone-200',
  };

  return <div className={cn(baseStyles, variants[variant], className)} {...props} />;
}
