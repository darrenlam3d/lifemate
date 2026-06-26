/**
 * Recurrence expansion.
 *
 * Expands a recurring Event into concrete instances within a [start, end)
 * window so the calendar & scheduler can treat every occurrence uniformly.
 */
import { addDays } from 'date-fns';
import { Event, RecurrenceRule } from '@/types/models';
import { fromISO, toISO } from '@/lib/time';

/** Expand all event instances (including recurrence) in a date window. */
export function expandEvents(events: Event[], windowStart: Date, windowEnd: Date): Event[] {
  const out: Event[] = [];
  for (const ev of events) {
    if (!ev.recurrence) {
      const s = fromISO(ev.start);
      const e = fromISO(ev.end);
      if (e > windowStart && s < windowEnd) out.push(ev);
      continue;
    }
    out.push(...expandRecurring(ev, windowStart, windowEnd));
  }
  return out;
}

function expandRecurring(ev: Event, windowStart: Date, windowEnd: Date): Event[] {
  const rule = ev.recurrence as RecurrenceRule;
  const out: Event[] = [];

  const durationMs = fromISO(ev.end).getTime() - fromISO(ev.start).getTime();
  const templateStart = fromISO(ev.start);
  const ruleEnd = rule.until ? new Date(`${rule.until}T23:59:59`) : windowEnd;
  const searchEnd = ruleEnd < windowEnd ? ruleEnd : windowEnd;
  const searchStart = windowStart < templateStart ? templateStart : windowStart;

  // Walk day-by-day from the template start, anchoring instances at the
  // template's local HH:mm. This keeps weekly byWeekday filtering simple and
  // gives correct results for the common cadences (daily / weekly weekdays).
  const startOfTemplate = startOfDayLocal(templateStart);
  let cursor = startOfDayLocal(searchStart);
  if (cursor < startOfTemplate) cursor = startOfTemplate;

  let guard = 0;
  while (cursor <= searchEnd && guard < 366 * 2) {
    guard++;
    if (matchesRule(cursor, rule, startOfTemplate)) {
      const instanceStart = atTemplateTime(cursor, templateStart);
      const instanceEnd = new Date(instanceStart.getTime() + durationMs);
      if (instanceEnd > windowStart && instanceStart < windowEnd && instanceStart <= ruleEnd) {
        out.push({
          ...ev,
          id: `${ev.id}_${instanceStart.toISOString()}`,
          recurringEventId: ev.id,
          start: toISO(instanceStart),
          end: toISO(instanceEnd),
        });
      }
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function atTemplateTime(day: Date, template: Date): Date {
  const d = new Date(day);
  d.setHours(template.getHours(), template.getMinutes(), template.getSeconds(), 0);
  return d;
}

function matchesRule(day: Date, rule: RecurrenceRule, templateDay: Date): boolean {
  switch (rule.freq) {
    case 'daily':
      return sameModInterval(daysSince(day, templateDay), rule.interval ?? 1);
    case 'weekly': {
      const weekday = day.getDay();
      const days = rule.byWeekday && rule.byWeekday.length ? rule.byWeekday : [templateDay.getDay()];
      if (!days.includes(weekday)) return false;
      return sameModInterval(weeksSince(day, templateDay), rule.interval ?? 1);
    }
    case 'monthly':
      return day.getDate() === templateDay.getDate();
    case 'yearly':
      return day.getDate() === templateDay.getDate() && day.getMonth() === templateDay.getMonth();
  }
}

/** Whole-day difference between two dates (calendar days). */
function daysSince(a: Date, b: Date): number {
  const da = startOfDayLocal(a).getTime();
  const db = startOfDayLocal(b).getTime();
  return Math.round((da - db) / 86_400_000);
}

function weeksSince(a: Date, b: Date): number {
  return Math.floor(daysSince(a, b) / 7);
}

function sameModInterval(n: number, interval: number): boolean {
  return n >= 0 && n % interval === 0;
}
