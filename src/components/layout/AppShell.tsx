/**
 * AppShell — the phone-style frame.
 *
 * Renders a fixed mobile viewport (max-width), a top header with the
 * notifications bell, the active page, and a bottom tab bar with 5 tabs
 * (Home, Calendar, Tasks, Goals, Insights). A global AI assistant and
 * notification center are mounted here.
 */
import { useState } from 'react';
import { Bell, CalendarDays, CheckSquare, Home as HomeIcon, LineChart, Sparkles, Target } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { HomePage } from '@/pages/HomePage';
import { CalendarPage } from '@/pages/CalendarPage';
import { TasksPage } from '@/pages/TasksPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { AIAssistant } from '@/components/assistant/AIAssistant';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

type Tab = 'home' | 'calendar' | 'tasks' | 'goals' | 'insights';

const TABS: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'insights', label: 'Insights', icon: LineChart },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>('home');
  const [assistant, setAssistant] = useState<{ open: boolean; prompt?: string }>({ open: false });
  const [notifOpen, setNotifOpen] = useState(false);

  const unread = useAppStore((s) => s.notifications.filter((n) => !n.read).length);
  const userName = useAppStore((s) => s.user.name);

  const openAssistant = (prompt?: string) => setAssistant({ open: true, prompt });
  const navigate = (t: Tab) => setTab(t);

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-slate-50 shadow-2xl">
      {/* Top bar */}
      <header className="safe-top z-20 flex items-center justify-between bg-white/80 px-4 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <Sparkles size={16} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-slate-900">LifeMate</p>
            <p className="text-[10px] text-slate-400">AI life assistant</p>
          </div>
        </div>
        <button
          onClick={() => setNotifOpen(true)}
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </header>

      {/* Active page */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'home' && <HomePage onOpenAssistant={openAssistant} onNavigate={navigate} />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'tasks' && <TasksPage onScheduleTask={(p) => openAssistant(p)} />}
        {tab === 'goals' && <GoalsPage onOpenAssistant={openAssistant} />}
        {tab === 'insights' && <InsightsPage />}
      </main>

      {/* Bottom tab bar */}
      <nav className="safe-bottom z-30 flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => navigate(t.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition',
                active ? 'text-brand-600' : 'text-slate-400',
              )}
            >
              <Icon size={20} className={cn('transition', active && 'scale-110')} />
              {t.label}
              {active && <span className="absolute -top-px h-0.5 w-8 rounded-full bg-brand-600" />}
            </button>
          );
        })}
      </nav>

      {/* Global overlays */}
      <AIAssistant
        open={assistant.open}
        initialPrompt={assistant.prompt}
        onClose={() => setAssistant({ open: false })}
      />
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onAction={(kind) => {
          if (kind === 'daily_plan' || kind === 'empty_slot' || kind === 'goal_alert') {
            openAssistant(kind === 'daily_plan' ? 'Plan my day' : undefined);
          }
        }}
      />

      {/* keeps userName referenced for future header use */}
      <span className="hidden">{userName}</span>
    </div>
  );
}
