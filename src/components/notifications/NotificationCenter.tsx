/**
 * NotificationCenter — a slide-over list of proactive reminders.
 *
 * Generated from the store's notifications (seed + AI-pushed). Includes the
 * notification kinds in the spec: upcoming events, empty-slot suggestions,
 * goal alerts, daily planning, and AI messages.
 */
import { Bell, BellRing, CheckCheck, Sparkles, Target, X } from 'lucide-react';
import { Modal, Button, EmptyState } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { NotificationKind } from '@/types/models';
import { fmtTime, fromISO } from '@/lib/time';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  onAction?: (kind: NotificationKind) => void;
}

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  upcoming_event: BellRing,
  empty_slot: Sparkles,
  goal_alert: Target,
  daily_plan: Sparkles,
  ai_message: Sparkles,
  reflection: Target,
};

const KIND_COLOR: Record<NotificationKind, string> = {
  upcoming_event: '#0ea5e9',
  empty_slot: '#6366f1',
  goal_alert: '#f59e0b',
  daily_plan: '#22c55e',
  ai_message: '#8b5cf6',
  reflection: '#ec4899',
};

export function NotificationCenter({ open, onClose, onAction }: NotificationCenterProps) {
  const { notifications, markAllNotificationsRead, clearNotification, markNotificationRead } = useAppStore();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Modal open={open} onClose={onClose} title={`Notifications${unread ? ` · ${unread} new` : ''}`}>
      <div className="flex h-[60vh] flex-col">
        {notifications.length > 0 ? (
          <>
            <div className="flex justify-end">
              <button
                onClick={markAllNotificationsRead}
                className="mb-2 flex items-center gap-1 text-xs font-semibold text-brand-600"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind];
                const color = KIND_COLOR[n.kind];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-3.5 transition',
                      n.read ? 'border-slate-100 bg-white' : 'border-brand-200 bg-brand-50/40',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a` }}>
                      <Icon size={16} style={{ color }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500">{n.body}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-slate-300">{fmtTime(n.createdAt)} · {fromISO(n.createdAt).toLocaleDateString()}</span>
                        {n.actionLabel && (
                          <Button
                            size="sm"
                            variant="subtle"
                            onClick={() => {
                              markNotificationRead(n.id);
                              onAction?.(n.kind);
                              onClose();
                            }}
                          >
                            {n.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => clearNotification(n.id)}
                      className="rounded p-1 text-slate-300 hover:text-slate-500"
                      aria-label="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState icon={Bell} title="You're all caught up" description="New reminders and AI suggestions will show up here." />
        )}
      </div>
    </Modal>
  );
}
