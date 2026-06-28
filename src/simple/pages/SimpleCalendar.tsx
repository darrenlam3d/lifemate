/**
 * SimpleCalendar — starts at the month view.
 *
 * Tapping a day drills into that day's agenda (a flat list of events), with a
 * back button to return to the month grid. No week view, no hour-grid.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { EmptyState } from '@/components/ui';
import { EventEditor } from '@/components/events/EventEditor';
import { CATEGORY_META, Event } from '@/types/models';
import { expandEvents } from '@/lib/recurrence';
import { fmtDay, fmtTime, fromISO, sameDay } from '@/lib/time';
import { cn } from '@/lib/utils';

export function SimpleCalendar() {
  const { events } = useAppStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editing, setEditing] = useState<{ open: boolean; event?: Event; defaults?: Partial<Event> }>({
    open: false,
  });

  // Build the month grid (6 rows of 7 days, Sunday-start).
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  // Expand events for the whole visible month so dots and counts are accurate.
  const monthInstances = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return expandEvents(events, start, end);
  }, [events, cursor]);

  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Day detail list.
  const dayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return monthInstances
      .filter((e) => sameDay(fromISO(e.start), selectedDay))
      .sort((a, b) => fromISO(a.start).getTime() - fromISO(b.start).getTime());
  }, [selectedDay, monthInstances]);

  return (
    <div className="flex h-full flex-col px-4 pb-28 pt-2">
      <header className="safe-top flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {selectedDay ? fmtDay(selectedDay) : cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h1>
          <p className="text-xs text-slate-400">{selectedDay ? 'Day view' : 'Month view'}</p>
        </div>

        <div className="flex items-center gap-1">
          {selectedDay ? (
            <button
              onClick={() => setSelectedDay(null)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              ← Month
            </button>
          ) : (
            <>
              <button
                onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Previous month"
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
                onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Next month"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Month grid */}
      {!selectedDay && (
        <div className="mt-4">
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
            {weekdayLabels.map((d, i) => (
              <div key={i} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayEvts = monthInstances.filter((e) => sameDay(fromISO(e.start), d));
              const isToday = sameDay(d, new Date());
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition',
                    inMonth ? 'bg-white text-slate-700 hover:bg-brand-50' : 'bg-transparent text-slate-300',
                    isToday && 'ring-2 ring-brand-500',
                    dayEvts.length > 0 && inMonth && 'bg-brand-50/60',
                  )}
                >
                  <span className={cn('font-semibold', isToday && 'text-brand-600')}>{d.getDate()}</span>
                  {dayEvts.length > 0 && (
                    <div className="mt-0.5 flex gap-0.5">
                      {dayEvts.slice(0, 3).map((e, j) => (
                        <span
                          key={j}
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: CATEGORY_META[e.category].color }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day detail */}
      {selectedDay && (
        <div className="mt-4 flex-1 overflow-y-auto">
          <button
            onClick={() => setEditing({ open: true, defaults: { start: nextHourISO(selectedDay) } })}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-brand-300 hover:text-brand-600"
          >
            + Add event on this day
          </button>

          {dayEvents.length > 0 ? (
            <div className="space-y-2">
              {dayEvents.map((e) => {
                const color = CATEGORY_META[e.category].color;
                return (
                  <button
                    key={e.id}
                    onClick={() => setEditing({ open: true, event: e })}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-card transition active:scale-[0.99]"
                  >
                    <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{e.title}</p>
                      <p className="text-xs text-slate-400">
                        {fmtTime(e.start)} – {fmtTime(e.end)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No events this day"
              description="Tap “Add event” above to create one."
            />
          )}
        </div>
      )}

      <EventEditor
        open={editing.open}
        event={editing.event}
        defaults={editing.defaults}
        onClose={() => setEditing({ open: false })}
      />
    </div>
  );
}

function nextHourISO(day: Date): string {
  const d = new Date(day);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}
