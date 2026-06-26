/**
 * Calendar — Day / Week / Month views.
 *
 * - Day & Week render an hour-grid timeline with event blocks and free gaps.
 * - Month renders a compact heatmap of busy days with a day-picker.
 * - Events are editable via the EventEditor sheet; creating/rescheduling never
 *   silently overwrites protected events.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  startOfWeek,
} from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { Card, Segmented } from '@/components/ui';
import { EventEditor } from '@/components/events/EventEditor';
import { CATEGORY_META, Event } from '@/types/models';
import { buildDayTimeline } from '@/lib/scheduler';
import { expandEvents } from '@/lib/recurrence';
import { fmtDay, fmtTime, fromISO, minutesBetween, durationMinutes, sameDay } from '@/lib/time';
import { cn } from '@/lib/utils';

type View = 'day' | 'week' | 'month';
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;
const HOUR_PX = 56; // height per hour in the timeline

export function CalendarPage() {
  const [view, setView] = useState<View>('day');
  const [cursor, setCursor] = useState(() => new Date());
  const { events, user, deleteEvent } = useAppStore();

  const [editing, setEditing] = useState<{ open: boolean; event?: Event; defaults?: Partial<Event> }>({
    open: false,
  });

  const shift = (days: number) => setCursor((c) => addDays(c, days));

  const window = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = endOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end };
    }
    if (view === 'month') {
      const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1), { weekStartsOn: 0 });
      const end = endOfWeek(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), { weekStartsOn: 0 });
      return { start, end };
    }
    return { start: cursor, end: addDays(cursor, 1) };
  }, [view, cursor]);

  const instances = useMemo(
    () => expandEvents(events, window.start, window.end),
    [events, window],
  );

  return (
    <div className="flex h-full flex-col px-4 pb-28 pt-2">
      {/* Top bar */}
      <div className="safe-top flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Calendar</h1>
          <p className="text-xs text-slate-400">{headerLabel(view, cursor)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shift(view === 'month' ? -30 : view === 'week' ? -7 : -1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          >
            Today
          </button>
          <button
            onClick={() => shift(view === 'month' ? 30 : view === 'week' ? 7 : 1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Segmented
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
        <button
          onClick={() => setEditing({ open: true, defaults: { start: nextHourISO(cursor) } })}
          className="flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-glow"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* Body */}
      <div className="mt-4 flex-1 overflow-y-auto">
        {view === 'day' && (
          <DayView day={cursor} events={instances} user={user} onEventClick={(e) => setEditing({ open: true, event: e })} />
        )}
        {view === 'week' && (
          <WeekView weekStart={window.start} events={instances} onEventClick={(e) => setEditing({ open: true, event: e })} />
        )}
        {view === 'month' && (
          <MonthView
            cursor={cursor}
            events={instances}
            onPickDay={(d) => {
              setCursor(d);
              setView('day');
            }}
          />
        )}
      </div>

      {/* Editor */}
      <EventEditor
        open={editing.open}
        event={editing.event}
        defaults={editing.defaults}
        onClose={() => setEditing({ open: false })}
      />

      {/* Quick delete when editing */}
      {editing.event && (
        <button
          onClick={() => {
            deleteEvent(editing.event!.id);
            setEditing({ open: false });
          }}
          className="mx-auto mt-2 flex items-center gap-1 text-xs font-semibold text-rose-500"
        >
          <Trash2 size={12} /> Delete this event
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Day view -------------------------------- */

function DayView({
  day,
  events,
  user,
  onEventClick,
}: {
  day: Date;
  events: Event[];
  user: ReturnType<typeof useAppStore.getState>['user'];
  onEventClick: (e: Event) => void;
}) {
  const dayEvents = events.filter((e) => overlapsDay(e, day)).sort((a, b) => fromISO(a.start).getTime() - fromISO(b.start).getTime());

  return (
    <div>
      <TimelineGrid day={day} events={dayEvents} onEventClick={onEventClick} />
      {/* Free time summary */}
      <FreeTimeList day={day} events={events} user={user} />
    </div>
  );
}

/* ------------------------------ Week view ------------------------------- */

function WeekView({
  weekStart,
  events,
  onEventClick,
}: {
  weekStart: Date;
  events: Event[];
  onEventClick: (e: Event) => void;
}) {
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const dayEvents = events.filter((e) => overlapsDay(e, d));
        return (
          <div key={d.toISOString()}>
            <div className="mb-1 flex items-center justify-between px-1">
              <span className={cn('text-xs font-bold uppercase', sameDay(d, new Date()) ? 'text-brand-600' : 'text-slate-400')}>
                {fmtDay(d)}
              </span>
              <span className="text-xs text-slate-300">{dayEvents.length} events</span>
            </div>
            {dayEvents.length > 0 ? (
              <TimelineGrid day={d} events={dayEvents} onEventClick={onEventClick} compact />
            ) : (
              <Card compact className="py-2 text-center text-xs text-slate-300">Free day</Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Month view ------------------------------ */

function MonthView({
  cursor,
  events,
  onPickDay,
}: {
  cursor: Date;
  events: Event[];
  onPickDay: (d: Date) => void;
}) {
  const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1), { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
        {weekdayLabels.map((d, i) => (
          <div key={i} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const count = events.filter((e) => overlapsDay(e, d)).length;
          const isToday = sameDay(d, new Date());
          return (
            <button
              key={i}
              onClick={() => onPickDay(d)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition',
                inMonth ? 'bg-white text-slate-700 hover:bg-brand-50' : 'bg-transparent text-slate-300',
                isToday && 'ring-2 ring-brand-500',
              )}
            >
              <span className={cn('font-semibold', isToday && 'text-brand-600')}>{d.getDate()}</span>
              {count > 0 && (
                <div className="mt-0.5 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <span key={j} className="h-1 w-1 rounded-full bg-brand-400" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- Timeline grid ------------------------------ */

function TimelineGrid({
  day,
  events,
  onEventClick,
  compact,
}: {
  day: Date;
  events: Event[];
  onEventClick: (e: Event) => void;
  compact?: boolean;
}) {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
  const pxPerMin = HOUR_PX / 60;
  const gridTop = new Date(day);
  gridTop.setHours(DAY_START_HOUR, 0, 0, 0);

  return (
    <Card className={cn('relative p-0', compact && 'py-2')}>
      <div className="relative" style={{ height: hours.length * HOUR_PX }}>
        {/* Hour lines */}
        {hours.map((h) => {
          const top = (h - DAY_START_HOUR) * HOUR_PX;
          return (
            <div key={h} className="absolute left-0 right-0 flex items-center" style={{ top }}>
              <span className="w-12 shrink-0 pr-2 text-right text-[10px] font-medium text-slate-300">
                {h % 12 === 0 ? 12 : h % 12}
                {h < 12 ? 'a' : 'p'}
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
          );
        })}

        {/* Event blocks */}
        {events.map((e) => {
          const start = fromISO(e.start);
          const offsetMin = Math.max(0, minutesBetween(gridTop, start));
          const durMin = Math.max(15, durationMinutes(e.start, e.end));
          const top = offsetMin * pxPerMin;
          const height = durMin * pxPerMin;
          const color = CATEGORY_META[e.category].color;
          return (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className="absolute left-12 right-2 overflow-hidden rounded-lg p-1.5 text-left text-white shadow-sm transition active:scale-[0.99]"
              style={{ top, height: Math.max(28, height - 2), backgroundColor: `${color}e6`, borderLeft: `3px solid ${color}` }}
            >
              <p className="truncate text-xs font-bold leading-tight">{e.title}</p>
              <p className="truncate text-[10px] opacity-90">
                {fmtTime(e.start)} – {fmtTime(e.end)}
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function FreeTimeList({
  day,
  events,
  user,
}: {
  day: Date;
  events: Event[];
  user: ReturnType<typeof useAppStore.getState>['user'];
}) {
  const timeline = useMemo(
    () => buildDayTimeline(day, events, user).filter((b) => b.kind === 'free'),
    [day, events, user],
  );
  if (timeline.length === 0) return null;
  return (
    <Card className="mt-3">
      <p className="section-title mb-2">Free gaps</p>
      <div className="space-y-1.5">
        {timeline.map((g) => (
          <div key={g.id} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-700">
              {fmtTime(g.start)} – {fmtTime(g.end)}
            </span>
            <span className="text-xs text-slate-400">· {durationMinutes(g.start, g.end)} min</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------ helpers --------------------------------- */

function overlapsDay(e: Event, day: Date): boolean {
  const s = fromISO(e.start);
  const dStart = new Date(day);
  dStart.setHours(0, 0, 0, 0);
  const dEnd = new Date(dStart);
  dEnd.setDate(dEnd.getDate() + 1);
  return s < dEnd && fromISO(e.end) > dStart;
}

function headerLabel(view: View, cursor: Date): string {
  return view === 'month'
    ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : fmtDay(cursor);
}

function nextHourISO(day: Date): string {
  const d = new Date(day);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}
