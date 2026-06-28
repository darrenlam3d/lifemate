/**
 * SimpleInsights — planned vs actual at a glance.
 *
 * Keeps the one most useful number (completion rate) and the activity list.
 * No phone-usage comparison, no charts, no reflection prompts.
 */
import { useMemo, useState } from 'react';
import { Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { addDays } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { Card, Badge, EmptyState, Segmented } from '@/components/ui';
import { ActivityLog, ActivityStatus, CATEGORY_META } from '@/types/models';
import { dayKey, fmtDay } from '@/lib/time';
import { formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Scope = 'day' | 'week';

export function SimpleInsights() {
  const { activityLogs } = useAppStore();
  const [scope, setScope] = useState<Scope>('day');
  const [day, setDay] = useState(() => addDays(new Date(), -1));

  const logs = useMemo(() => {
    if (scope === 'day') return activityLogs.filter((l) => l.date === dayKey(day));
    // Week: Monday to Sunday around `day`.
    const monday = addDays(day, -((day.getDay() + 6) % 7));
    const sunday = addDays(monday, 6);
    const start = dayKey(monday);
    const end = dayKey(sunday);
    return activityLogs.filter((l) => l.date >= start && l.date <= end);
  }, [activityLogs, day, scope]);

  const planned = logs.reduce((s, l) => s + (l.plannedMinutes ?? 0), 0);
  const actual = logs.reduce((s, l) => s + (l.actualMinutes ?? 0), 0);
  const rate = planned > 0 ? Math.round((actual / planned) * 100) : 0;

  return (
    <div className="flex h-full flex-col px-4 pb-28 pt-2">
      <header className="safe-top pt-2">
        <h1 className="text-xl font-extrabold text-slate-900">Insights</h1>
        <p className="text-xs text-slate-400">Planned vs. actual</p>
      </header>

      <div className="mt-3 flex items-center justify-between">
        <Segmented
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as Scope)}
        />
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <button onClick={() => setDay((d) => addDays(d, scope === 'week' ? -7 : -1))} className="rounded p-1 hover:bg-slate-100">
            <Minus size={14} />
          </button>
          <span className="min-w-[100px] text-center font-semibold text-slate-600">{fmtDay(day)}</span>
          <button onClick={() => setDay((d) => addDays(d, scope === 'week' ? 7 : 1))} className="rounded p-1 hover:bg-slate-100">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
        <Card>
          <p className="section-title">Completion</p>
          <p className="mt-1 text-4xl font-extrabold text-slate-900">{rate}%</p>
          <p className="text-xs text-slate-400">
            {formatDuration(actual)} of {formatDuration(planned)}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
              style={{ width: `${Math.min(100, rate)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            {rate >= 80 ? (
              <Badge className="bg-emerald-50 text-emerald-600"><TrendingUp size={12} /> Strong</Badge>
            ) : rate >= 50 ? (
              <Badge className="bg-amber-50 text-amber-600">Steady</Badge>
            ) : (
              <Badge className="bg-rose-50 text-rose-600"><TrendingDown size={12} /> Slipped</Badge>
            )}
          </div>
        </Card>

        <section>
          <h2 className="section-title mb-2">Activities</h2>
          {logs.length > 0 ? (
            <Card className="divide-y divide-slate-100 p-0">
              {logs.map((l) => (
                <ActivityRow key={l.id} log={l} />
              ))}
            </Card>
          ) : (
            <Card compact>
              <EmptyState icon={TrendingUp} title="Nothing logged yet" />
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function ActivityRow({ log }: { log: ActivityLog }) {
  const meta = CATEGORY_META[log.category];
  const statusColor: Record<ActivityStatus, string> = {
    completed: 'text-emerald-600',
    partial: 'text-amber-600',
    missed: 'text-rose-500',
    planned: 'text-slate-400',
  };
  return (
    <div className="flex items-center gap-3 p-3.5">
      <span className="h-8 w-1 rounded-full" style={{ backgroundColor: meta.color }} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{log.title}</p>
        <p className={cn('text-xs capitalize', statusColor[log.status])}>
          {log.status} · {formatDuration(log.actualMinutes ?? 0)} / {formatDuration(log.plannedMinutes ?? 0)}
        </p>
      </div>
    </div>
  );
}
