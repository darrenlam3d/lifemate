/**
 * Core domain models for LifeMate.
 *
 * Every entity shares an `id` and lifecycle timestamps so they can be
 * persisted/swapped to a real backend later without reshaping the store.
 *
 * All date/time values are ISO 8601 strings (UTC). Conversion to the user's
 * local timezone happens only at the presentation layer.
 */

export type ID = string;
export type ISODate = string; // e.g. "2026-06-24T09:00:00.000Z"
export type ISODateString = string; // calendar day "YYYY-MM-DD"

/* ------------------------------- User ----------------------------------- */

export interface UserPreferences {
  /** Local work-day boundaries, in 24h local time. Used by the scheduler. */
  workStart: string; // "09:00"
  workEnd: string; // "17:00"
  sleepStart: string; // "23:00"
  sleepEnd: string; // "07:00"
  /** Default scheduling horizon for goal auto-placement. */
  planningHorizonDays: number;
  /** Whether proactive notifications are enabled. */
  notificationsEnabled: boolean;
}

export interface User {
  id: ID;
  name: string;
  email?: string;
  timezone: string; // IANA tz, e.g. "America/New_York"
  avatarColor: string; // tailwind-ish hex used for the avatar bubble
  preferences: UserPreferences;
  createdAt: ISODate;
}

/* ----------------------------- Recurrence ------------------------------- */

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Every N units, e.g. every 2 weeks. Default 1. */
  interval?: number;
  /** For weekly: 0=Sun .. 6=Sat. Which weekdays it applies to. */
  byWeekday?: number[];
  /** Inclusive end date for the recurrence, or undefined = forever. */
  until?: ISODateString;
}

/* ------------------------------- Event ---------------------------------- */

/** A category drives color + how the scheduler protects it. */
export type EventCategory =
  | 'sleep'
  | 'work'
  | 'focus'
  | 'health'
  | 'social'
  | 'personal'
  | 'learning'
  | 'errands'
  | 'travel'
  | 'other';

export interface Event {
  id: ID;
  title: string;
  notes?: string;
  start: ISODate;
  end: ISODate;
  allDay?: boolean;
  location?: string;
  category: EventCategory;
  /**
   * Protected events cannot be moved/deleted by the auto-scheduler without
   * explicit user confirmation. Sleep/work/fixed events default to true.
   */
  protected: boolean;
  recurrence?: RecurrenceRule;
  /** If this instance came from a recurring template, the template id. */
  recurringEventId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ------------------------------- Task ----------------------------------- */

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: ID;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Optional due date (calendar day or datetime). */
  due?: ISODate;
  /** If the AI suggested a calendar slot, it lives here until confirmed. */
  suggestedStart?: ISODate;
  suggestedEnd?: ISODate;
  /** Optional estimate in minutes, helps the planner. */
  estimateMinutes?: number;
  /** Links to a goal so completion counts toward goal progress. */
  goalId?: ID;
  completedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ------------------------------- Goal ----------------------------------- */

export type GoalCadence = 'daily' | 'weekly' | 'monthly';

export interface Goal {
  id: ID;
  title: string;
  category: EventCategory;
  /** e.g. 3 sessions/week, 5 hours/week, 60 minutes/day */
  cadence: GoalCadence;
  /** Target quantity within one cadence period. */
  target: number;
  /** What the target counts: number of sessions or minutes. */
  unit: 'sessions' | 'minutes';
  /** Preferred duration per session in minutes (for scheduling blocks). */
  preferredDurationMinutes: number;
  /** Day window the AI prefers to place these (24h local). */
  preferredWindow?: { start: string; end: string };
  /** Free-form note like "avoid early mornings". */
  notes?: string;
  color: string;
  active: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ----------------------------- TimeBlock -------------------------------- */

/**
 * A TimeBlock is a placed slice of time the planner uses. It may be a
 * committed Event, a free gap, a goal block, or a focus block.
 */
export type TimeBlockKind =
  | 'event'
  | 'free'
  | 'goal'
  | 'focus'
  | 'sleep';

export interface TimeBlock {
  id: ID;
  kind: TimeBlockKind;
  start: ISODate;
  end: ISODate;
  /** Reference to the source entity, if any. */
  eventId?: ID;
  goalId?: ID;
  taskId?: ID;
  title: string;
  category?: EventCategory;
  /** True when the AI proposed it but it isn't committed yet. */
  proposed?: boolean;
}

/* --------------------------- ActivityLog -------------------------------- */

export type ActivityStatus = 'planned' | 'completed' | 'partial' | 'missed';

export interface ActivityLog {
  id: ID;
  /** The calendar day this log belongs to. */
  date: ISODateString;
  title: string;
  category: EventCategory;
  /** What actually happened. */
  start?: ISODate;
  end?: ISODate;
  /** Actual minutes spent (may differ from planned). */
  actualMinutes?: number;
  plannedMinutes?: number;
  status: ActivityStatus;
  /** Linked entity for joining back to the plan. */
  eventId?: ID;
  goalId?: ID;
  taskId?: ID;
  note?: string;
  createdAt: ISODate;
}

/* ----------------------------- Insight ---------------------------------- */

export type InsightKind =
  | 'summary' // generic stat/observation
  | 'goal_warning' // goal falling behind
  | 'suggestion' // AI suggestion
  | 'phone'; // phone usage comparison

export interface Insight {
  id: ID;
  kind: InsightKind;
  title: string;
  detail: string;
  /** ISO date the insight applies to (day or week start). */
  scope: ISODateString;
  /** Optional severity for warnings. */
  severity?: 'info' | 'warning' | 'critical';
  /** Optional action the user can take. */
  action?: { label: string; kind: 'schedule' | 'log' | 'dismiss' };
  createdAt: ISODate;
}

/* --------------------------- PhoneUsage --------------------------------- */
/**
 * Stubbed phone-usage data model. The shape is defined now so the Insights
 * layer can be built against it; the real OS integration comes later.
 */
export interface PhoneAppUsage {
  packageName: string;
  appName: string;
  category: 'social' | 'entertainment' | 'productivity' | 'communication' | 'other';
  minutes: number;
}

export interface PhoneUsageDay {
  date: ISODateString;
  totalScreenMinutes: number;
  apps: PhoneAppUsage[];
  /** Whether this is real (from OS) or simulated data. */
  source: 'real' | 'simulated';
}

/* --------------------------- Notification ------------------------------- */

export type NotificationKind =
  | 'upcoming_event'
  | 'empty_slot'
  | 'goal_alert'
  | 'daily_plan'
  | 'ai_message'
  | 'reflection';

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  /** Optional deep link target. */
  actionLabel?: string;
}

/* --------------------------- Helpers ------------------------------------ */

export const CATEGORY_META: Record<
  EventCategory,
  { label: string; color: string; protectedByDefault: boolean }
> = {
  sleep: { label: 'Sleep', color: '#6366f1', protectedByDefault: true },
  work: { label: 'Work', color: '#0ea5e9', protectedByDefault: true },
  focus: { label: 'Focus', color: '#8b5cf6', protectedByDefault: false },
  health: { label: 'Health', color: '#22c55e', protectedByDefault: false },
  social: { label: 'Social', color: '#f59e0b', protectedByDefault: false },
  personal: { label: 'Personal', color: '#ec4899', protectedByDefault: false },
  learning: { label: 'Learning', color: '#14b8a6', protectedByDefault: false },
  errands: { label: 'Errands', color: '#f97316', protectedByDefault: false },
  travel: { label: 'Travel', color: '#64748b', protectedByDefault: false },
  other: { label: 'Other', color: '#94a3b8', protectedByDefault: false },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string; rank: number }> = {
  urgent: { label: 'Urgent', color: '#ef4444', rank: 0 },
  high: { label: 'High', color: '#f59e0b', rank: 1 },
  medium: { label: 'Medium', color: '#3b82f6', rank: 2 },
  low: { label: 'Low', color: '#94a3b8', rank: 3 },
};
