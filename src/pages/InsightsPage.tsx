/**
 * Insights — activity reflection + phone-usage comparison.
 *
 * Shows planned-vs-actual summaries for a day or week, lets the user log what
 * they really did, and surfaces the (stubbed) phone-usage data model so screen
 * time can be compared against planned activities once OS integration lands.
 */
import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Minus,
  Plus,
  Smartphone,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { addDays, startOfWeek } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { Card, Badge, EmptyState, Segmented, Button, Modal } from '@/components/ui';
import { ActivityLog, ActivityStatus, CATEGORY_META } from '@/types/models';
import { dayKey, fmtDay } from '@/lib/time';
import { cn, formatDuration } from '@/lib/utils';

type Scope = 'day' | 'week';

export function InsightsPage() {
  const { activityLogs, phoneUsage, goals, events, user, addActivityLog } = useAppStore();
  const [scope, setScope] = useState<Scope>('day');
  const [day, setDay] = useState(() => addDays(new Date(), -1)); // reflect on yesterday by default
  const [logging, setLogging] = useState(false);

  const weekStart = useMemo(() => startOfWeek(day, { weekStartsOn: 1 }), [day]);

  const logs = useMemo(() => {
    if (scope === 'day') return activityLogs.filter((l) => l.date === dayKey(day));
    const start = dayKey(weekStart);
    const end = dayKey(addDays(weekStart, 6));
    return activityLogs.filter((l) => l.date >= start && l.date <= end);
  }, [activityLogs, day, scope, weekStart]);

  const planned = logs.reduce((s, l) => s + (l.plannedMinutes ?? 0), 0);
  const actual = logs.reduce((s, l) => s + (l.actualMinutes ?? 0), 0);
  const completionRate = planned > 0 ? Math.round((actual / planned) * 100) : 0;

  // Phone usage for the selected scope.
  const usage = useMemo(() => {
    const toApps = (rows: { appName: string; category: string; minutes: number }[]) =>
      rows.map((a) => ({ name: a.appName, cat: a.category, minutes: a.minutes }));
    if (scope === 'day') {
      const d = phoneUsage.find((p) => p.date === dayKey(day));
      if (!d) return undefined;
      return { totalScreenMinutes: d.totalScreenMinutes, apps: toApps(d.apps), source: d.source };
    }
    const start = dayKey(weekStart);
    const end = dayKey(addDays(weekStart, 6));
    const days = phoneUsage.filter((p) => p.date >= start && p.date <= end);
    const total = days.reduce((s, d) => s + d.totalScreenMinutes, 0);
    const apps = new Map<string, { name: string; cat: string; minutes: number }>();
    days.forEach((d) =>
      d.apps.forEach((a) => {
        const cur = apps.get(a.appName) ?? { name: a.appName, cat: a.category, minutes: 0 };
        cur.minutes += a.minutes;
        apps.set(a.appName, cur);
      }),
    );
    return {
      totalScreenMinutes: total,
      apps: Array.from(apps.values()).sort((a, b) => b.minutes - a.minutes),
      source: 'simulated' as const,
    };
  }, [phoneUsage, day, scope, weekStart]);

  // Derived insight comparing phone vs planned focus.
  const focusMinutes = logs
    .filter((l) => l.category === 'focus' || l.category === 'learning')
    .reduce((s, l) => s + (l.actualMinutes ?? 0), 0);

  return (
    <div className="flex h-full flex-col px-4 pb-28 pt-2">
      <header className="safe-top flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Insights</h1>
          <p className="text-xs text-slate-400">Planned vs. actual · phone usage</p>
        </div>
        <Button size="sm" onClick={() => setLogging(true)}>
          <Plus size={14} /> Log
        </Button>
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
          <span className="min-w-[110px] text-center font-semibold text-slate-600">
            {scope === 'day' ? fmtDay(day) : `${fmtDay(weekStart)} – ${fmtDay(addDays(weekStart, 6))}`}
          </span>
          <button onClick={() => setDay((d) => addDays(d, scope === 'week' ? 7 : 1))} className="rounded p-1 hover:bg-slate-100">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
        {/* Headline stat */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Planned vs. Actual</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">{completionRate}%</p>
              <p className="text-xs text-slate-400">
                {formatDuration(actual)} of {formatDuration(planned)} done
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {completionRate >= 80 ? (
                <Badge className="bg-emerald-50 text-emerald-600">
                  <TrendingUp size={12} /> Strong day
                </Badge>
              ) : completionRate >= 50 ? (
                <Badge className="bg-amber-50 text-amber-600">Steady</Badge>
              ) : (
                <Badge className="bg-rose-50 text-rose-600">
                  <TrendingDown size={12} /> Slipped
                </Badge>
              )}
              <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, completionRate)}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Activity breakdown */}
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
              <EmptyState icon={Activity} title="Nothing logged yet" description="Tap “Log” to record what you actually did." />
            </Card>
          )}
        </section>

        {/* Phone usage */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-1.5">
              <Smartphone size={12} /> Phone usage
            </h2>
            <Badge className="bg-slate-100 text-slate-500">
              {usage?.totalScreenMinutes ? formatDuration(usage.totalScreenMinutes) : '0m'}
            </Badge>
          </div>
          <PhoneUsageCard usage={usage} focusMinutes={focusMinutes} />
        </section>

        {/* Gentle nudge */}
        {focusMinutes < 30 && usage && usage.totalScreenMinutes > focusMinutes * 3 && (
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-800">Gentle nudge 💛</p>
            <p className="mt-1 text-xs text-amber-700">
              You spent about {formatDuration(usage.totalScreenMinutes)} on your phone but only {formatDuration(focusMinutes)} on focus/learning.
              Want to protect a block for deep work tomorrow?
            </p>
          </Card>
        )}

        <Card compact className="border-dashed bg-slate-50">
          <div className="flex items-start gap-2">
            <BarChart3 size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Data model ready.</span> Phone-usage figures are simulated. Connect the OS screen-time
              integration later (the {goals.length} goals, {events.length} events and {user.preferences.planningHorizonDays}-day horizon all wire up automatically).
            </p>
          </div>
        </Card>
      </div>

      <LogSheet open={logging} onClose={() => setLogging(false)} defaultDate={day} onLog={(l) => addActivityLog(l)} />
    </div>
  );
}

/* ------------------------------ Subviews -------------------------------- */

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
          {log.status} · {formatDuration(log.actualMinutes ?? 0)} / {formatDuration(log.plannedMinutes ?? 0)} planned
        </p>
      </div>
    </div>
  );
}

function PhoneUsageCard({
  usage,
  focusMinutes,
}: {
  usage:
    | { totalScreenMinutes: number; apps: { name: string; cat: string; minutes: number }[]; source?: string }
    | undefined;
  focusMinutes: number;
}) {
  if (!usage || usage.totalScreenMinutes === 0) {
    return (
      <Card compact>
        <p className="text-sm text-slate-400">No phone-usage data for this period.</p>
      </Card>
    );
  }
  const max = Math.max(...usage.apps.map((a) => a.minutes), 1);
  const ratio = focusMinutes > 0 ? usage.totalScreenMinutes / focusMinutes : null;
  return (
    <Card>
      {usage.apps.slice(0, 6).map((a) => (
        <div key={a.name} className="mb-2.5 last:mb-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">{a.name}</span>
            <span className="text-slate-400">{formatDuration(a.minutes)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-400" style={{ width: `${(a.minutes / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {ratio !== null && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
          <Clock size={13} />
          Phone time was <span className="font-bold text-slate-700">{ratio.toFixed(1)}×</span> your focus time.
        </div>
      )}
    </Card>
  );
}

/* --------------------------- Log activity ------------------------------- */

function LogSheet({
  open,
  onClose,
  defaultDate,
  onLog,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  onLog: (l: Omit<ActivityLog, 'id' | 'createdAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<keyof typeof CATEGORY_META>('focus');
  const [minutes, setMinutes] = useState(30);
  const [status, setStatus] = useState<ActivityStatus>('completed');

  function submit() {
    if (!title.trim()) return;
    onLog({
      date: dayKey(defaultDate),
      title: title.trim(),
      category,
      actualMinutes: status === 'missed' ? 0 : minutes,
      plannedMinutes: minutes,
      status,
    });
    setTitle('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log activity · ${fmtDay(defaultDate)}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button fullWidth onClick={submit} disabled={!title.trim()}>
            Save log
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FieldL label="What did you do?">
          <input className="lm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Side project coding" autoFocus />
        </FieldL>
        <FieldL label="Category">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn('pill', category === c && 'ring-2')}
                style={{ backgroundColor: `${CATEGORY_META[c].color}1a`, color: CATEGORY_META[c].color }}
              >
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </FieldL>
        <FieldL label={`Duration: ${minutes} min`}>
          <input type="range" min={5} max={240} step={5} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="w-full accent-brand-600" />
        </FieldL>
        <FieldL label="Outcome">
          <div className="flex gap-2">
            {(['completed', 'partial', 'missed'] as ActivityStatus[]).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={cn('chip', status === s && 'chip-on')}>
                {s}
              </button>
            ))}
          </div>
        </FieldL>
      </div>
      <style>{`
        .lm-input{width:100%;border-radius:.75rem;border:1px solid #e2e8f0;background:#fff;padding:.55rem .75rem;font-size:.9rem;outline:none}
        .lm-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
        .chip{border-radius:.6rem;padding:.4rem .7rem;font-size:.75rem;font-weight:600;background:#f1f5f9;color:#475569;text-transform:capitalize}
        .chip-on{background:#6366f1;color:#fff}
      `}</style>
    </Modal>
  );
}

function FieldL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
