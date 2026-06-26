import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, color, className, dot }: BadgeProps) {
  return (
    <span
      className={cn('pill', !color && 'bg-slate-100 text-slate-600', className)}
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
    >
      {dot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color ?? '#94a3b8' }}
        />
      )}
      {children}
    </span>
  );
}
