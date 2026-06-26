/**
 * AIService — a thin, swappable wrapper around "the model".
 *
 * The app talks only to `AIService` (via the exported singleton). The default
 * implementation is `MockAIService`, which uses deterministic natural-language
 * parsing and the local scheduler. To plug in a real LLM later, implement
 * `AIProvider` and call `configureAIService(realProvider)` at boot — no UI or
 * store code needs to change.
 */
import {
  detectConflict,
  findFreeSlots,
  proposeAlternatives,
} from '@/lib/scheduler';
import { fromISO, toISO, dateAtLocalTime, plusMinutes, fmtTime, fmtDay } from '@/lib/time';
import { Event, EventCategory, Goal, Task, User } from '@/types/models';

/* ----------------------------- Public types ----------------------------- */

export interface AIContext {
  user: User;
  events: Event[];
  tasks: Task[];
  goals: Goal[];
  now: Date;
}

/** The intent the AI extracted from the user's request. */
export type AIIntent =
  | 'create_event'
  | 'create_task'
  | 'schedule_goal'
  | 'find_free_time'
  | 'plan_day'
  | 'unknown';

export interface AISlotSuggestion {
  start: string;
  end: string;
  reason: string;
}

export interface AIFollowUp {
  /** What the AI still needs to know. */
  question: string;
  /** Which field of `ParsedDraft` this answers. */
  field: 'title' | 'date' | 'duration' | 'category';
}

export interface AIDraft {
  intent: AIIntent;
  title?: string;
  /** Day offset relative to today (0 = today). */
  dayOffset?: number;
  startTime?: string; // "HH:mm"
  durationMinutes?: number;
  category?: EventCategory;
  /** Suggested placements (only for scheduling intents). */
  suggestions?: AISlotSuggestion[];
  /** Conflicts found, if a specific time was requested. */
  conflicts?: { title: string; start: string; end: string }[];
  /** Human explanation of what the AI did. */
  explanation: string;
  /** If essential info is missing, the AI asks one focused question. */
  followUp?: AIFollowUp;
  /** Whether the draft is ready to apply without further input. */
  ready: boolean;
}

export interface AIProvider {
  /** Parse a natural-language request into a structured draft. */
  parse(input: string, ctx: AIContext): Promise<AIDraft>;
  /** Generate a human-readable daily plan summary. */
  planDay(ctx: AIContext): Promise<string>;
}

/* ----------------------------- Configuration ---------------------------- */

let provider: AIProvider | null = null;

export function configureAIService(p: AIProvider): void {
  provider = p;
}

export function getAIService(): AIProvider {
  if (!provider) {
    provider = new MockAIService();
  }
  return provider;
}

/* --------------------------- Mock implementation ------------------------ */

/**
 * MockAIService — deterministic, dependency-free NLP + scheduling.
 *
 * It is intentionally pragmatic: it handles the common phrasings in the spec
 * ("gym tomorrow at 7", "add study time this week", "free time tomorrow"),
 * asks a single follow-up only when an essential detail is missing, and always
 * explains its reasoning in plain language.
 */
export class MockAIService implements AIProvider {
  async parse(input: string, ctx: AIContext): Promise<AIDraft> {
    const text = input.toLowerCase().trim();

    // ----- Intent routing -----
    if (/\b(free|open|empty|gap|available)\b.*\b(time|slot|hour)\b|find .* (free|open)/.test(text)) {
      return this.handleFindFreeTime(text, ctx);
    }
    if (/\bplan\b.*(day|today|schedule)|make a plan|daily plan/.test(text)) {
      return { intent: 'plan_day', ready: true, explanation: 'Generating a plan from your tasks and goals…' };
    }

    // Default: treat as a create request (event or task).
    return this.handleCreate(text, ctx, input);
  }

  async planDay(ctx: AIContext): Promise<string> {
    const todayTasks = ctx.tasks.filter(
      (t) => t.status !== 'done' && (!t.due || fromISO(t.due) <= fromISO(toISO(endOfToday(ctx.now)))),
    );
    const goal = ctx.goals.find((g) => g.id === 'goal_project');
    const lines: string[] = [];
    lines.push(`Here's a plan for ${fmtDay(ctx.now)}.`);
    if (todayTasks.length) {
      lines.push(`Top priority: "${todayTasks[0].title}".`);
    }
    if (goal) {
      lines.push(`I've reserved ${goal.preferredDurationMinutes} minutes tonight for "${goal.title}".`);
    }
    lines.push('Your mornings are protected for sleep and focused work, so I left them untouched.');
    return lines.join(' ');
  }

  /* ----------------------- create / schedule --------------------------- */

  private handleCreate(text: string, ctx: AIContext, raw: string): AIDraft {
    const dayOffset = parseDayOffset(text);
    const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    const duration = parseDuration(text);
    const category = guessCategory(text);
    const title = extractTitle(raw);

    // If the user named a known goal, route to goal scheduling.
    const goal = ctx.goals.find(
      (g) => g.active && text.includes(g.title.toLowerCase().split(' ')[0]),
    );

    // ----- Specific time provided → try to place exactly there -----
    if (timeMatch && dayOffset !== undefined) {
      const { hh, mm } = normalizeTime(timeMatch);
      const start = dateAtLocalTime(new Date(ctx.now.getFullYear(), ctx.now.getMonth(), ctx.now.getDate() + dayOffset), `${hh}:${mm}`);
      const dur = duration ?? goal?.preferredDurationMinutes ?? 60;
      const end = plusMinutes(toISO(start), dur);

      const conflict = detectConflict(ctx.events, toISO(start), end);
      if (conflict.hasConflict) {
        const alts = proposeAlternatives(
          ctx.now,
          ctx.events,
          ctx.user,
          dur,
          { start: `${hh}:${mm}`, end: addHours(hh, mm, 2) },
        );
        return {
          intent: 'create_event',
          title: title ?? goal?.title ?? 'Event',
          dayOffset,
          startTime: `${hh}:${mm}`,
          durationMinutes: dur,
          category: goal?.category ?? category,
          conflicts: conflict.overlapping.map((e) => ({ title: e.title, start: e.start, end: e.end })),
          suggestions: alts.slice(0, 3).map((s) => ({
            start: s.start,
            end: s.end,
            reason: `Free ${fmtDay(s.start)} at ${fmtTime(s.start)} (${s.capacityMinutes} min open).`,
          })),
          explanation: `That slot is taken by "${conflict.overlapping[0].title}". I won't overwrite it — here are some alternatives instead.`,
          ready: false,
          followUp: { question: 'Want one of these slots, or a different time?', field: 'date' },
        };
      }

      return {
        intent: 'create_event',
        title: title ?? goal?.title ?? 'Event',
        dayOffset,
        startTime: `${hh}:${mm}`,
        durationMinutes: dur,
        category: goal?.category ?? category,
        explanation: `Got it — "${title ?? goal?.title ?? 'Event'}" on ${fmtDay(start)} at ${fmtTime(start)} for ${dur} min.`,
        ready: true,
      };
    }

    // ----- "add study time this week" style → goal schedule -----
    if (goal) {
      const slots = findFreeSlots(ctx.now, ctx.events, ctx.user, {
        durationMinutes: goal.preferredDurationMinutes,
        dayOffsets: dayOffset !== undefined ? [dayOffset] : [0, 1, 2, 3, 4],
        preferredWindow: goal.preferredWindow,
      });
      return {
        intent: 'schedule_goal',
        title: goal.title,
        category: goal.category,
        dayOffset,
        suggestions: slots.slice(0, 4).map((s) => ({
          start: s.start,
          end: s.end,
          reason: `Open ${fmtDay(s.start)} at ${fmtTime(s.start)}, inside your preferred ${goal.preferredWindow?.start}–${goal.preferredWindow?.end} window.`,
        })),
        durationMinutes: goal.preferredDurationMinutes,
        explanation: `I found ${slots.length} open slot${slots.length === 1 ? '' : 's'} for "${goal.title}". Pick one and I'll book it.`,
        ready: slots.length > 0,
        followUp: slots.length === 0 ? { question: `No open ${goal.preferredDurationMinutes}-min slot this week — want me to loosen the time window?`, field: 'date' } : undefined,
      };
    }

    // ----- Minimal follow-up if title is missing -----
    if (!title) {
      return {
        intent: 'create_event',
        explanation: "I'd love to add that — what should I call it?",
        ready: false,
        followUp: { question: 'What is the event or task called?', field: 'title' },
      };
    }

    // ----- Create task when no time is given -----
    if (timeMatch === null && dayOffset === undefined) {
      return {
        intent: 'create_task',
        title,
        category,
        explanation: `Added "${title}" to your task list. Tell me a time if you want it on the calendar.`,
        ready: true,
      };
    }

    // ----- Has a day but no time → suggest a slot -----
    const dur = duration ?? 60;
    const window = category === 'health' ? { start: '07:00', end: '09:00' } : { start: '18:00', end: '21:00' };
    const slots = findFreeSlots(ctx.now, ctx.events, ctx.user, {
      durationMinutes: dur,
      dayOffsets: [dayOffset ?? 0],
      preferredWindow: window,
    });
    return {
      intent: 'create_event',
      title,
      dayOffset,
      category,
      durationMinutes: dur,
      suggestions: slots.slice(0, 3).map((s) => ({
        start: s.start,
        end: s.end,
        reason: `Free ${fmtTime(s.start)}–${fmtTime(s.end)} (${s.capacityMinutes} min open).`,
      })),
      explanation: `You didn't give a time, so I looked for openings ${relativeLabel(dayOffset)}. Tap a slot to confirm.`,
      ready: false,
      followUp: { question: 'Which slot works for you?', field: 'date' },
    };
  }

  /* ----------------------- find free time ------------------------------ */

  private handleFindFreeTime(text: string, ctx: AIContext): AIDraft {
    const dayOffset = parseDayOffset(text) ?? 1;
    const dur = parseDuration(text) ?? 60;
    const slots = findFreeSlots(ctx.now, ctx.events, ctx.user, {
      durationMinutes: dur,
      dayOffsets: [dayOffset],
    });
    return {
      intent: 'find_free_time',
      durationMinutes: dur,
      dayOffset,
      suggestions: slots.slice(0, 5).map((s) => ({
        start: s.start,
        end: s.end,
        reason: `${s.capacityMinutes} min free starting ${fmtTime(s.start)}.`,
      })),
      explanation:
        slots.length > 0
          ? `You have ${slots.length} open slot${slots.length === 1 ? '' : 's'} of ${dur}+ min ${relativeLabel(dayOffset)}.`
          : `Nothing open for ${dur} min ${relativeLabel(dayOffset)}. Want me to check another day?`,
      ready: true,
      followUp: slots.length === 0 ? { question: 'Should I check a different day or shorter duration?', field: 'duration' } : undefined,
    };
  }
}

/* ----------------------------- NLP helpers ------------------------------ */

function parseDayOffset(text: string): number | undefined {
  if (/\btoday\b/.test(text)) return 0;
  if (/\btomorrow\b|\btmrw\b|\btmr\b/.test(text)) return 1;
  if (/\bday after tomorrow\b|\bin 2 days\b/.test(text)) return 2;
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    const re = new RegExp(`\\b(next\\s+)?${weekdays[i]}\\b`);
    const m = text.match(re);
    if (m) {
      const today = new Date().getDay();
      let diff = (i - today + 7) % 7;
      if (m[1]) diff = diff === 0 ? 7 : diff; // "next X"
      if (diff === 0) diff = 7; // weekday name → next occurrence
      return diff;
    }
  }
  const inDays = text.match(/\bin (\d+) days?\b/);
  if (inDays) return parseInt(inDays[1], 10);
  if (/\bthis week\b/.test(text)) return 1; // earliest this week
  return undefined;
}

function parseDuration(text: string): number | undefined {
  const h = text.match(/(\d+)\s*(?:hours?|hrs?|h)\b/);
  if (h) return parseInt(h[1], 10) * 60;
  const m = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

function normalizeTime(m: RegExpMatchArray): { hh: string; mm: string } {
  // Two alternative shapes from the regex.
  const h1 = m[1] ?? m[4];
  const min1 = m[2] ?? m[5] ?? '0';
  const ampm = m[3] ?? m[6];
  let h = parseInt(h1, 10);
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return { hh: String(h).padStart(2, '0'), mm: String(parseInt(min1, 10) || 0).padStart(2, '0') };
}

function addHours(hh: string, mm: string, hours: number): string {
  const h = parseInt(hh, 10) + hours;
  return `${String(h).padStart(2, '0')}:${mm}`;
}

const CATEGORY_KEYWORDS: { category: EventCategory; words: string[] }[] = [
  { category: 'health', words: ['gym', 'workout', 'run', 'jog', 'yoga', 'exercise', 'training'] },
  { category: 'learning', words: ['study', 'read', 'book', 'course', 'learn', 'class', 'lecture'] },
  { category: 'focus', words: ['project', 'code', 'build', 'focus', 'deep work', 'write', 'design'] },
  { category: 'social', words: ['dinner', 'lunch', 'coffee', 'meet', 'friend', 'call', 'date'] },
  { category: 'errands', words: ['grocery', 'shopping', 'errand', 'appointment', 'dentist', 'doctor'] },
  { category: 'work', words: ['meeting', 'standup', 'work', 'sync', 'review'] },
];

function guessCategory(text: string): EventCategory {
  for (const c of CATEGORY_KEYWORDS) {
    if (c.words.some((w) => text.includes(w))) return c.category;
  }
  return 'other';
}

/** Pull a title out of the raw phrase by stripping schedule-y words. */
function extractTitle(raw: string): string | undefined {
  // Common phrasings: "add <title> tomorrow", "schedule <title> at 7", "remind me to <title>"
  let t = raw.trim();
  const strip = /^(add|schedule|book|plan|create|set|remind me to|i want to|i'd like to|let's|can you|please)\s+/i;
  t = t.replace(strip, '');
  // Remove time/day tokens.
  t = t
    .replace(/\b(today|tomorrow|tmrw|tmr|tonight|this week|next week)\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\bfor\s+\d+\s*(hour|hr|minute|min|h|m)s?\b/gi, '')
    .replace(/\b(in|on)\s+\w+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Strip trailing connector words.
  t = t.replace(/^(for|to)\s+/i, '').trim();
  if (!t || t.length < 2) return undefined;
  return capitalize(t);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function relativeLabel(dayOffset?: number): string {
  if (dayOffset === undefined) return '';
  if (dayOffset === 0) return 'today';
  if (dayOffset === 1) return 'tomorrow';
  if (dayOffset === 7) return 'next week';
  return `in ${dayOffset} days`;
}

function endOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}
