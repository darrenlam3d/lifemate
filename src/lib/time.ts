import {
  addDays as dfAddDays,
  addMinutes,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { GoalCadence, ISODate, ISODateString } from '@/types/models';

export const addDays = dfAddDays;

export function toISO(d: Date): ISODate {
  return d.toISOString();
}

export function fromISO(iso: string): Date {
  return parseISO(iso);
}

/** Calendar-day key "YYYY-MM-DD" in local time. */
export function dayKey(d: Date | string): ISODateString {
  const date = typeof d === 'string' ? fromISO(d) : d;
  return format(date, 'yyyy-MM-dd');
}

/** Human-friendly time, e.g. "7:00 AM". */
export function fmtTime(d: Date | string): string {
  const date = typeof d === 'string' ? fromISO(d) : d;
  return format(date, 'h:mm a');
}

/** e.g. "Mon, Jun 24". */
export function fmtDay(d: Date | string): string {
  const date = typeof d === 'string' ? fromISO(d) : d;
  return format(date, 'EEE, MMM d');
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? fromISO(d) : d;
  return format(date, 'EEEE, MMMM d, yyyy');
}

export function minutesBetween(a: string | Date, b: string | Date): number {
  const da = typeof a === 'string' ? fromISO(a) : a;
  const db = typeof b === 'string' ? fromISO(b) : b;
  return differenceInMinutes(db, da);
}

/** Minutes of duration of a [start,end) window. */
export function durationMinutes(start: string, end: string): number {
  return Math.max(0, minutesBetween(start, end));
}

export function plusMinutes(d: string | Date, minutes: number): ISODate {
  const date = typeof d === 'string' ? fromISO(d) : d;
  return toISO(addMinutes(date, minutes));
}

export function todayKey(): ISODateString {
  return dayKey(new Date());
}

export function startOfLocalDay(d: Date | string): Date {
  const date = typeof d === 'string' ? fromISO(d) : d;
  return startOfDay(date);
}

export function sameDay(a: string | Date, b: string | Date): boolean {
  const da = typeof a === 'string' ? fromISO(a) : a;
  const db = typeof b === 'string' ? fromISO(b) : b;
  return isSameDay(da, db);
}

/** Build a Date for today (or `dayDate`) at a local "HH:mm". */
export function dateAtLocalTime(dayDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function relativeDayLabel(d: Date | string): string {
  const date = typeof d === 'string' ? fromISO(d) : d;
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return format(date, 'EEEE');
  return format(date, 'EEE, MMM d');
}

export function cadenceLabel(c: GoalCadence): string {
  return c === 'daily' ? '/day' : c === 'weekly' ? '/week' : '/month';
}

/** Friendly greeting based on local hour. */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
