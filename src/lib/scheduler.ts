/**
 * The scheduling engine.
 *
 * Responsibilities:
 *  - Build a day's TimeBlock timeline (events + sleep + free gaps).
 *  - Find free time slots given constraints (duration, preferred window).
 *  - Distribute repeating goals into open blocks within a horizon.
 *  - Detect conflicts and propose alternative placements.
 *  - Protect sleep / work / fixed events per the priority rules.
 *
 * This is pure, deterministic logic with no React/state coupling, so it can be
 * unit-tested and reused by both the AI planner and the UI.
 */
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  isBefore,
  isWithinInterval,
  startOfWeek,
} from 'date-fns';
import {
  Event,
  Goal,
  GoalCadence,
  ISODate,
  TimeBlock,
  User,
} from '@/types/models';
import { dateAtLocalTime, fromISO, toISO } from '@/lib/time';
import { expandEvents } from '@/lib/recurrence';
import { uid } from '@/lib/utils';

export const MIN_SLOT_MINUTES = 15;

interface Interval {
  start: Date;
  end: Date;
}

/* ------------------------------------------------------------------ *
 * Day timeline construction
 * ------------------------------------------------------------------ */

/**
 * Build the full TimeBlock timeline for a single day, including an implicit
 * sleep block derived from user preferences and the gaps (free time) between
 * busy blocks.
 */
export function buildDayTimeline(
  day: Date,
  events: Event[],
  user: User,
): TimeBlock[] {
  const dayStart = atLocal(day, '00:00');
  const dayEnd = atLocal(addDays(day, 1), '00:00');

  const instances = expandEvents(events, dayStart, dayEnd);

  // Build a list of busy intervals.
  const busy: Interval[] = instances
    .filter((e) => !e.allDay)
    .map((e) => ({ start: fromISO(e.start), end: fromISO(e.end) }));

  // Sort & merge overlapping intervals.
  const merged = mergeIntervals(busy);

  const blocks: TimeBlock[] = [];

  // Map merged busy intervals back to their events for labels/colors.
  for (const ev of instances) {
    blocks.push({
      id: uid('tb'),
      kind: 'event',
      start: ev.start,
      end: ev.end,
      eventId: ev.id,
      title: ev.title,
      category: ev.category,
    });
  }

  // Compute free gaps between merged busy intervals within the waking window.
  const waking = wakingWindow(day, user); // [wake, sleep]
  const free = freeGaps(merged, waking.start, waking.end);

  // Mark the sleep region as a sleep block (outside waking window).
  const sleepBlock: TimeBlock = {
    id: uid('tb'),
    kind: 'sleep',
    start: toISO(sleepStart(day, user)),
    end: toISO(waking.start),
    title: 'Sleep',
    category: 'sleep',
  };

  for (const f of free) {
    blocks.push({
      id: uid('tb'),
      kind: 'free',
      start: toISO(f.start),
      end: toISO(f.end),
      title: 'Free',
    });
  }

  // Sort by start time. Sleep block sits at the beginning of the day.
  return [sleepBlock, ...blocks].sort((a, b) => fromISO(a.start).getTime() - fromISO(b.start).getTime());
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), cur.end.getTime()));
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** Compute free gaps (>= MIN_SLOT_MINUTES) within [rangeStart, rangeEnd). */
function freeGaps(busy: Interval[], rangeStart: Date, rangeEnd: Date): Interval[] {
  const gaps: Interval[] = [];
  let cursor = rangeStart;
  const sorted = mergeIntervals(busy).filter((i) => i.end > rangeStart && i.start < rangeEnd);
  for (const b of sorted) {
    if (b.start > cursor) {
      gaps.push({ start: cursor, end: b.start });
    }
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd });
  return gaps.filter((g) => differenceInMinutes(g.end, g.start) >= MIN_SLOT_MINUTES);
}

/* ------------------------------------------------------------------ *
 * Free-slot search
 * ------------------------------------------------------------------ */

export interface SlotSearchOptions {
  /** Required contiguous minutes. */
  durationMinutes: number;
  /** Day offsets from today to search (inclusive). */
  dayOffsets: number[];
  /** Preferred local-time window per day, e.g. "19:00"–"21:00". */
  preferredWindow?: { start: string; end: string };
  /** If true, only return slots that fall fully inside the preferred window. */
  strictWindow?: boolean;
}

export interface FreeSlot {
  start: ISODate;
  end: ISODate;
  /** Minutes the slot can hold (>= durationMinutes). */
  capacityMinutes: number;
  /** How well it matches the preferred window (0 = best). */
  preferenceScore: number;
  dayOffset: number;
}

/**
 * Find free slots that fit `durationMinutes`, ordered by preference.
 * Never overlaps protected events or sleep.
 */
export function findFreeSlots(
  today: Date,
  events: Event[],
  user: User,
  opts: SlotSearchOptions,
): FreeSlot[] {
  const results: FreeSlot[] = [];

  for (const offset of opts.dayOffsets) {
    const day = addDays(today, offset);
    const dayStart = atLocal(day, '00:00');
    const dayEnd = atLocal(addDays(day, 1), '00:00');
    const instances = expandEvents(events, dayStart, dayEnd);
    const busy: Interval[] = instances
      .filter((e) => !e.allDay)
      .map((e) => ({ start: fromISO(e.start), end: fromISO(e.end) }));

    const waking = wakingWindow(day, user);
    const searchStart = opts.preferredWindow
      ? clampDate(atLocal(day, opts.preferredWindow.start), waking.start, waking.end)
      : waking.start;
    const searchEnd = opts.preferredWindow
      ? clampDate(atLocal(day, opts.preferredWindow.end), waking.start, waking.end)
      : waking.end;

    const gaps = freeGaps(busy, searchStart, searchEnd);
    for (const g of gaps) {
      const capacity = differenceInMinutes(g.end, g.start);
      if (capacity < opts.durationMinutes) continue;
      // Slide within the gap to find the earliest fitting start.
      const start = g.start;
      const end = addMinutes(start, opts.durationMinutes);
      const score = preferenceScore(start, opts.preferredWindow);
      results.push({
        start: toISO(start),
        end: toISO(end),
        capacityMinutes: capacity,
        preferenceScore: score,
        dayOffset: offset,
      });
    }
  }

  // Sort by best preference, then earliest.
  return results.sort((a, b) => a.preferenceScore - b.preferenceScore || a.start.localeCompare(b.start));
}

function clampDate(d: Date, min: Date, max: Date): Date {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

/** Lower is better. Penalize distance from the middle of the preferred window. */
function preferenceScore(start: Date, window?: { start: string; end: string }): number {
  if (!window) return 0;
  const [sh, sm] = window.start.split(':').map(Number);
  const [eh, em] = window.end.split(':').map(Number);
  const midMin = (sh * 60 + sm + eh * 60 + em) / 2;
  const startMin = start.getHours() * 60 + start.getMinutes();
  return Math.abs(startMin - midMin);
}

/* ------------------------------------------------------------------ *
 * Conflict detection & alternatives
 * ------------------------------------------------------------------ */

export interface ConflictResult {
  hasConflict: boolean;
  /** Events that overlap the proposed window. */
  overlapping: Event[];
}

export function detectConflict(
  events: Event[],
  start: ISODate,
  end: ISODate,
  ignoreEventId?: string,
): ConflictResult {
  const s = fromISO(start);
  const e = fromISO(end);
  const overlapping = events.filter((ev) => {
    if (ev.id === ignoreEventId) return false;
    const es = fromISO(ev.start);
    const ee = fromISO(ev.end);
    return es < e && ee > s;
  });
  return { hasConflict: overlapping.length > 0, overlapping };
}

/**
 * Propose up to `maxAlternatives` alternative placements near a requested time
 * that was unavailable. Never overwrites protected events.
 */
export function proposeAlternatives(
  today: Date,
  events: Event[],
  user: User,
  durationMinutes: number,
  preferredWindow?: { start: string; end: string },
  maxAlternatives = 3,
): FreeSlot[] {
  const slots = findFreeSlots(today, events, user, {
    durationMinutes,
    dayOffsets: [0, 1, 2, 3, 4, 5, 6],
    preferredWindow,
  });
  return slots.slice(0, maxAlternatives);
}

/* ------------------------------------------------------------------ *
 * Goal distribution
 * ------------------------------------------------------------------ */

export interface GoalPlacement {
  goalId: string;
  title: string;
  color: string;
  category: Goal['category'];
  /** Proposed TimeBlocks for the period. */
  blocks: TimeBlock[];
  /** Whether the full target could be scheduled. */
  fullyScheduled: boolean;
  /** Target vs scheduled amount. */
  targetAmount: number;
  scheduledAmount: number;
}

export interface DistributionResult {
  placements: GoalPlacement[];
  /** TimeBlocks for all goals combined (proposed). */
  blocks: TimeBlock[];
}

/**
 * Distribute active goals into open time across a horizon, respecting priority
 * rules: sleep, work and protected events are never overwritten; lower-priority
 * goals are placed after higher-priority ones.
 */
export function distributeGoals(
  today: Date,
  events: Event[],
  goals: Goal[],
  user: User,
  horizonDays = user.preferences.planningHorizonDays,
): DistributionResult {
  const dayOffsets = Array.from({ length: horizonDays }, (_, i) => i);
  const proposedEvents: Event[] = []; // proposed goal blocks act like events for conflict checks

  // Order goals: daily first (most frequent constraint), then weekly, monthly.
  const ordered = [...goals].sort((a, b) => cadenceRank(a.cadence) - cadenceRank(b.cadence));

  const allBlocks: TimeBlock[] = [];
  const placements: GoalPlacement[] = [];

  for (const goal of ordered) {
    const perDay = targetPerDay(goal);
    const blocks: TimeBlock[] = [];
    let scheduled = 0;

    for (const offset of dayOffsets) {
      if (scheduled >= targetForHorizon(goal, horizonDays)) break;
      const needed = perDay;
      if (needed <= 0) continue;

      const slot = findFreeSlots(today, [...events, ...proposedEvents], user, {
        durationMinutes: goal.preferredDurationMinutes,
        dayOffsets: [offset],
        preferredWindow: goal.preferredWindow,
        strictWindow: true,
      })[0];

      if (slot) {
        // Reserve the slot by adding a proposed event so subsequent goals/offsets see it.
        const ev: Event = {
          id: uid('goal_ev'),
          title: goal.title,
          category: goal.category,
          protected: false,
          start: slot.start,
          end: slot.end,
          createdAt: toISO(new Date()),
          updatedAt: toISO(new Date()),
        };
        proposedEvents.push(ev);
        blocks.push({
          id: uid('tb'),
          kind: 'goal',
          start: slot.start,
          end: slot.end,
          goalId: goal.id,
          title: goal.title,
          category: goal.category,
          proposed: true,
        });
        scheduled += goal.unit === 'minutes' ? goal.preferredDurationMinutes : 1;
      }
    }

    const targetAmount = targetForHorizon(goal, horizonDays);
    placements.push({
      goalId: goal.id,
      title: goal.title,
      color: goal.color,
      category: goal.category,
      blocks,
      fullyScheduled: scheduled >= targetAmount,
      targetAmount,
      scheduledAmount: scheduled,
    });
    allBlocks.push(...blocks);
  }

  return { placements, blocks: allBlocks };
}

function cadenceRank(c: GoalCadence): number {
  return c === 'daily' ? 0 : c === 'weekly' ? 1 : 2;
}

/** How much of the goal target applies per day, in the goal's own unit. */
function targetPerDay(goal: Goal): number {
  if (goal.cadence === 'daily') return goal.target;
  if (goal.cadence === 'weekly') return Math.ceil(goal.target / 7);
  return Math.ceil(goal.target / 30);
}

/** Total target amount across the planning horizon. */
function targetForHorizon(goal: Goal, horizonDays: number): number {
  if (goal.cadence === 'daily') return goal.target * horizonDays;
  if (goal.cadence === 'weekly') return goal.target;
  return goal.target; // monthly — leave as-is for the horizon window
}

/* ------------------------------------------------------------------ *
 * Waking / sleep windows
 * ------------------------------------------------------------------ */

function wakingWindow(day: Date, user: User): Interval {
  const wake = atLocal(day, user.preferences.sleepEnd);
  const sleep = sleepStart(day, user);
  return { start: wake, end: sleep };
}

/** Sleep start for a given day: if sleepStart < sleepEnd (overnight), it's today's evening. */
function sleepStart(day: Date, user: User): Date {
  return atLocal(day, user.preferences.sleepStart);
}

function atLocal(day: Date, hhmm: string): Date {
  return dateAtLocalTime(day, hhmm);
}

/* ------------------------------------------------------------------ *
 * Convenience: aggregate free time
 * ------------------------------------------------------------------ */

export interface FreeTimeSummary {
  totalFreeMinutes: number;
  gaps: { start: ISODate; end: ISODate; minutes: number }[];
}

/** Total free waking time on a given day. */
export function freeTimeOnDay(day: Date, events: Event[], user: User): FreeTimeSummary {
  const dayStart = atLocal(day, '00:00');
  const dayEnd = atLocal(addDays(day, 1), '00:00');
  const instances = expandEvents(events, dayStart, dayEnd);
  const busy: Interval[] = instances
    .filter((e) => !e.allDay)
    .map((e) => ({ start: fromISO(e.start), end: fromISO(e.end) }));
  const waking = wakingWindow(day, user);
  const gaps = freeGaps(busy, waking.start, waking.end);
  const total = gaps.reduce((s, g) => s + differenceInMinutes(g.end, g.start), 0);
  return {
    totalFreeMinutes: total,
    gaps: gaps.map((g) => ({
      start: toISO(g.start),
      end: toISO(g.end),
      minutes: differenceInMinutes(g.end, g.start),
    })),
  };
}

/** Start of the week (Sunday) for a given date. */
export function weekStart(day: Date): Date {
  return startOfWeek(day, { weekStartsOn: 0 });
}

/** Check whether a date falls inside [startISO, endISO). */
export function isWithin(startISO: ISODate, endISO: ISODate, when: Date): boolean {
  return isWithinInterval(when, { start: fromISO(startISO), end: fromISO(endISO) });
}

/** Is the given event protected or in a protected category? */
export function isProtected(ev: Event): boolean {
  return ev.protected || ev.category === 'sleep' || ev.category === 'work';
}

/** Helper exposed for the planner: earliest date in the horizon. */
export function horizonEnd(today: Date, horizonDays: number): Date {
  return addDays(today, horizonDays);
}

export { isBefore };
