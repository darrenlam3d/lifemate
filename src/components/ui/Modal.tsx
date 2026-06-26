import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Renders as a bottom sheet on mobile (default), centered dialog otherwise. */
  variant?: 'sheet' | 'center';
}

export function Modal({ open, onClose, title, children, footer, variant = 'sheet' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-10 w-full animate-slide-up bg-white shadow-2xl',
          variant === 'sheet'
            ? 'mt-auto rounded-t-3xl safe-bottom'
            : 'm-auto max-w-md rounded-3xl',
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Grabber handle for sheet */}
        {variant === 'sheet' && (
          <div className="flex justify-center pt-3">
            <div className="h-1.5 w-10 rounded-full bg-slate-200" />
          </div>
        )}
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3 safe-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
