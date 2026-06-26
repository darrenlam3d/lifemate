/**
 * Home — the daily dashboard.
 *
 * Shows: greeting + live clock, next event, today's free-time blocks, today's
 * top tasks, goal progress at a glance, and AI-suggested next actions. The
 * primary CTA opens the AI assistant.
 */
import { useMemo } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coffee,
  Plus,
  Sparkles,
  Sunset,
  Target,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useNow } from '@/hooks/useNow';
import { Card, Badge, Avatar } from '@/components/ui';
import { CATEGORY_META, Event } from '@/types/models';
import { freeTimeOnDay } from '@/lib/scheduler';
import { computeAllGoalProgress } from '@/lib/goals';
import {
  fmtDate,
  fmtTime,
  fromISO,
  greeting,
  minutesBetween,
  plusMinutes,
} from '@/lib/time';
import { cn, formatDuration } from '@/lib/utils';

interface HomePageProps {
  onOpenAssistant: (prompt?: string) => void;
  onNavigate: (tab: 'calendar' | 'tasks' | 'goals' | 'insights') => void;
}

export function HomePage({ onOpenAssistant, onNavigate }: HomePageProps) {
  const now = useNow();
  const { user, events, tasks, goals, activityLogs } = useAppStore();

  const todayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now.getDate()]);

  const free = useMemo(() => freeTimeOnDay(todayStart, events, user), [todayStart, events, user]);

  const nextEvent = useMemo(() => {
    const upcoming = events
      .flatMap((e) => (e.recurrence ? expandOne(e, todayStart) : [e]))
      .filter((e) => fromISO(e.end) > now)
      .sort((a, b) => fromISO(a.start).getTime() - fromISO(b.start).getTime());
    return upcoming[0];
  }, [events, todayStart, now]);

  const todayTasks = useMemo(() => {
    const endOfToday = plusMinutes(todayStart.toISOString(), 24 * 60);
    return tasks
      .filter((t) => t.status !== 'done' && (!t.due || fromISO(t.due) <= fromISO(endOfToday)))
      .sort((a, b) => rankPriority(a.priority) - rankPriority(b.priority))
      .slice(0, 4);
  }, [tasks, todayStart]);

  const goalProgress = useMemo(
    () => computeAllGoalProgress(goals, tasks, activityLogs, now),
    [goals, tasks, activityLogs, now],
  );

  const suggestedActions = useMemo(() => buildSuggestions(goals, free, now), [goals, free, now]);

  const hoursFree = Math.floor(free.totalFreeMinutes / 60);
  const minsFree = free.totalFreeMinutes % 60;

  return (
    <div className="space-y-5 px-4 pb-28 pt-2">
      {/* Header */}
      <header className="safe-top flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {fmtDate(now)}
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {greeting()}, {user.name} 👋
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {free.totalFreeMinutes > 0
              ? `You have ${hoursFree > 0 ? `${hoursFree}h ` : ''}${minsFree}m of free time today.`
              : 'Your day is fully booked.'}
          </p>
        </div>
        <Avatar name={user.name} color={user.avatarColor} size={44} />
      </header>

      {/* Primary AI CTA */}
      <button
        onClick={() => onOpenAssistant()}
        className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-4 text-left text-white shadow-glow transition active:scale-[0.99]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
          <Sparkles size={22} />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Ask AI to plan your day</p>
          <p className="text-xs text-white/80">“Gym tomorrow at 7” · “Find me an hour to focus”</p>
        </div>
        <ChevronRight size={18} className="text-white/70" />
      </button>

      {/* Next event */}
      <Card>
        <div className="flex items-center justify-between">
          <span className="section-title">Up next</span>
          <button onClick={() => onNavigate('calendar')} className="text-xs font-semibold text-brand-600">
            Calendar →
          </button>
        </div>
        {nextEvent ? (
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex h-12 w-1.5 rounded-full"
              style={{ backgroundColor: CATEGORY_META[nextEvent.category].color }}
            />
            <div className="flex-1">
              <p className="font-bold text-slate-900">{nextEvent.title}</p>
              <p className="text-sm text-slate-500">
                {fmtTime(nextEvent.start)} · in {Math.max(0, Math.round(minutesBetween(now, nextEvent.start) / 60))} min
              </p>
            </div>
            {nextEvent.location && <Badge className="bg-slate-100 text-slate-500">{nextEvent.location}</Badge>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Nothing scheduled. Enjoy the breathing room.</p>
        )}
      </Card>

      {/* Free time blocks */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Free time today</h2>
          {free.gaps.length > 0 && (
            <span className="text-xs font-medium text-slate-400">
              {formatDuration(free.totalFreeMinutes)} total
            </span>
          )}
        </div>
        {free.gaps.length > 0 ? (
          <div className="space-y-2">
            {free.gaps.slice(0, 4).map((g, i) => (
              <Card key={i} compact className="flex items-center gap-3 py-3">
                <Coffee size={18} className="text-emerald-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {fmtTime(g.start)} – {fmtTime(g.end)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDuration(g.minutes)} open</p>
                </div>
                <button
                  onClick={() => onOpenAssistant(`Schedule something at ${fmtTime(g.start)}`)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  + Use
                </button>
              </Card>
            ))}
          </div>
        ) : (
          <Card compact>
            <p className="text-sm text-slate-400">No free gaps left today. Tomorrow is a fresh start.</p>
          </Card>
        )}
      </section>

      {/* Today's tasks */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Today's tasks</h2>
          <button onClick={() => onNavigate('tasks')} className="text-xs font-semibold text-brand-600">
            All tasks →
          </button>
        </div>
        <Card className="divide-y divide-slate-100 p-0">
          {todayTasks.length > 0 ? (
            todayTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3.5">
                <Circle size={18} className="shrink-0 text-slate-300" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{t.title}</p>
                  {t.due && <p className="text-xs text-slate-400">due {fmtTime(t.due)}</p>}
                </div>
                <PriorityDot priority={t.priority} />
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-slate-400">All caught up for today. 🎉</p>
          )}
        </Card>
      </section>

      {/* Goals at a glance */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Goals this week</h2>
          <button onClick={() => onNavigate('goals')} className="text-xs font-semibold text-brand-600">
            Goals →
          </button>
        </div>
        <div className="space-y-2">
          {goalProgress.map(({ goal, done, target, fraction, atRisk }) => (
            <Card key={goal.id} compact>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={15} style={{ color: goal.color }} />
                  <span className="text-sm font-semibold text-slate-800">{goal.title}</span>
                </div>
                <span className={cn('text-xs font-bold', atRisk ? 'text-amber-600' : 'text-slate-400')}>
                  {done}/{target}
                  {goal.unit === 'minutes' ? 'm' : ''}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${fraction * 100}%`, backgroundColor: goal.color }}
                />
              </div>
              {atRisk && (
                <p className="mt-1.5 text-xs text-amber-600">⚠ Falling behind — want to fit a session in?</p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* AI suggested next actions */}
      <section>
        <h2 className="mb-2 section-title">Suggested next actions</h2>
        <div className="space-y-2">
          {suggestedActions.map((a, i) => (
            <button
              key={i}
              onClick={() => onOpenAssistant(a.prompt)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-card transition active:scale-[0.99]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Zap size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400">{a.detail}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      </section>

      {/* Floating add button */}
      <button
        onClick={() => onOpenAssistant()}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-glow transition active:scale-90"
        aria-label="New"
      >
        <Plus size={26} />
      </button>

      <div className="flex items-center justify-center gap-1 pt-2 text-xs text-slate-300">
        <Sunset size={12} /> <CalendarClock size={12} /> <CheckCircle2 size={12} /> LifeMate
      </div>
    </div>
  );
}

/* ------------------------------ helpers --------------------------------- */

function rankPriority(p: string): number {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[p] ?? 9;
}

function PriorityDot({ priority }: { priority: string }) {
  const color = { urgent: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8' }[priority] ?? '#94a3b8';
  return <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

/** Expand a recurring event to a single instance overlapping `day`, if any. */
function expandOne(ev: Event, day: Date): Event[] {
  // Lightweight single-day overlap check; full expansion lives in the scheduler.
  const start = fromISO(ev.start);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  if (!ev.recurrence) {
    return fromISO(ev.end) > dayStart && start < dayEnd ? [ev] : [];
  }
  // For the home preview, include the template if it could occur today.
  const weekdayOk =
    !ev.recurrence.byWeekday || ev.recurrence.byWeekday.length === 0 || ev.recurrence.byWeekday.includes(day.getDay());
  return weekdayOk ? [ev] : [];
}

function buildSuggestions(
  goals: ReturnType<typeof useAppStore.getState>['goals'],
  free: ReturnType<typeof freeTimeOnDay>,
  now: Date,
) {
  const actions: { title: string; detail: string; prompt: string }[] = [];
  const atRisk = goals.find((g) => {
    // reuse a simple heuristic for the suggestion list
    return g.cadence === 'weekly';
  });
  if (atRisk) {
    actions.push({
      title: `Fit in "${atRisk.title}"`,
      detail: 'You have an open goal this week — I can find a slot.',
      prompt: `Schedule ${atRisk.title} this week`,
    });
  }
  if (free.totalFreeMinutes >= 60) {
    actions.push({
      title: 'Block a focus hour',
      detail: `You have ${formatDuration(free.totalFreeMinutes)} free — protect deep work time.`,
      prompt: 'Block 1 hour of focus time today',
    });
  }
  if (now.getHours() >= 19) {
    actions.push({
      title: 'Wind down & reflect',
      detail: 'Log what you actually did today so I can learn your patterns.',
      prompt: 'Help me reflect on today',
    });
  }
  if (actions.length === 0) {
    actions.push({
      title: 'Plan your day',
      detail: 'Let me turn your tasks and goals into a schedule.',
      prompt: 'Plan my day',
    });
  }
  return actions.slice(0, 3);
}
