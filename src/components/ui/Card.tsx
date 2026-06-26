import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  compact?: boolean;
}

export function Card({ children, compact, className, ...rest }: CardProps) {
  return (
    <div className={cn(compact ? 'card-compact' : 'card', className)} {...rest}>
      {children}
    </div>
  );
}
