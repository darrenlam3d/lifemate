/**
 * SimpleApp — the stripped-down variant shell.
 *
 * Tabs: Home, Calendar, Insights. The home screen is the focus: today's tasks,
 * inline goal CRUD, and a compact "what's next" peek. No AI banner, no free-time
 * gap list, no Tasks/Goals tabs.
 */
import { useState } from 'react';
import { CalendarDays, Home as HomeIcon, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimpleHome } from './pages/SimpleHome';
import { SimpleCalendar } from './pages/SimpleCalendar';
import { SimpleInsights } from './pages/SimpleInsights';

type Tab = 'home' | 'calendar' | 'insights';

const TABS: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'insights', label: 'Insights', icon: LineChart },
];

export function SimpleApp() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-slate-50">
      <main className="flex-1 overflow-y-auto">
        {tab === 'home' && <SimpleHome />}
        {tab === 'calendar' && <SimpleCalendar />}
        {tab === 'insights' && <SimpleInsights />}
      </main>

      <nav className="safe-bottom z-30 flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition',
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
    </div>
  );
}
