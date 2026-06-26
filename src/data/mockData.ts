/**
 * Seed mock data for LifeMate.
 *
 * Times are anchored relative to "today" so the demo always looks alive.
 * We build everything from a `now` reference using local-time helpers so the
 * scheduler sees realistic day boundaries in the user's timezone.
 */
import {
  ActivityLog,
  AppNotification,
  Event,
  Goal,
  PhoneUsageDay,
  Task,
  User,
} from '@/types/models';
import { addDays, dateAtLocalTime, dayKey, toISO } from '@/lib/time';

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function at(dayOffset: number, hhmm: string): string {
  return toISO(dateAtLocalTime(addDays(today, dayOffset), hhmm));
}

/* -------------------------------- User ---------------------------------- */

export const seedUser: User = {
  id: 'user_me',
  name: 'Alex',
  email: 'alex@lifemate.app',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  avatarColor: '#6366f1',
  preferences: {
    workStart: '09:00',
    workEnd: '17:00',
    sleepStart: '23:00',
    sleepEnd: '07:00',
    planningHorizonDays: 7,
    notificationsEnabled: true,
  },
  createdAt: toISO(addDays(today, -120)),
};

/* ------------------------------- Events --------------------------------- */

export const seedEvents: Event[] = [
  // Recurring sleep block (protected) — daily
  {
    id: 'evt_sleep',
    title: 'Sleep',
    category: 'sleep',
    protected: true,
    start: at(0, '23:00'),
    end: at(1, '07:00'),
    recurrence: { freq: 'daily' },
    createdAt: toISO(addDays(today, -90)),
    updatedAt: toISO(addDays(today, -1)),
  },
  // Recurring work — weekdays
  {
    id: 'evt_work',
    title: 'Work · Deep Hours',
    category: 'work',
    protected: true,
    start: at(0, '09:00'),
    end: at(0, '12:30'),
    recurrence: { freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] },
    createdAt: toISO(addDays(today, -90)),
    updatedAt: toISO(addDays(today, -2)),
  },
  {
    id: 'evt_work_pm',
    title: 'Work · Meetings',
    category: 'work',
    protected: true,
    start: at(0, '14:00'),
    end: at(0, '17:00'),
    recurrence: { freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] },
    createdAt: toISO(addDays(today, -90)),
    updatedAt: toISO(addDays(today, -2)),
  },
  // Lunch
  {
    id: 'evt_lunch',
    title: 'Lunch',
    category: 'personal',
    protected: false,
    start: at(0, '12:30'),
    end: at(0, '13:30'),
    recurrence: { freq: 'daily' },
    createdAt: toISO(addDays(today, -60)),
    updatedAt: toISO(addDays(today, -5)),
  },
  // A specific one-off today
  {
    id: 'evt_dentist',
    title: 'Dentist appointment',
    notes: 'Cleaning + check-up',
    category: 'errands',
    protected: true,
    location: 'Bright Smile Clinic',
    start: at(0, '17:30'),
    end: at(0, '18:30'),
    createdAt: toISO(addDays(today, -3)),
    updatedAt: toISO(addDays(today, -1)),
  },
  // Tomorrow standup
  {
    id: 'evt_standup',
    title: 'Team standup',
    category: 'work',
    protected: true,
    start: at(1, '09:30'),
    end: at(1, '09:45'),
    createdAt: toISO(addDays(today, -2)),
    updatedAt: toISO(addDays(today, -1)),
  },
  // Weekend social
  {
    id: 'evt_dinner',
    title: 'Dinner with Sam',
    category: 'social',
    protected: false,
    location: 'Downtown',
    start: at(nextWeekday(6), '19:00'),
    end: at(nextWeekday(6), '21:00'),
    createdAt: toISO(addDays(today, -1)),
    updatedAt: toISO(addDays(today, -1)),
  },
];

/** Offset (in days) of the next occurrence of a given weekday (0=Sun). */
function nextWeekday(weekday: number): number {
  const dow = today.getDay();
  let diff = (weekday - dow + 7) % 7;
  if (diff === 0) diff = 7; // next week's, not today
  return diff;
}

/* ------------------------------- Tasks ---------------------------------- */

export const seedTasks: Task[] = [
  {
    id: 'tsk_1',
    title: 'Finish Q3 proposal draft',
    priority: 'high',
    status: 'in_progress',
    due: at(0, '18:00'),
    estimateMinutes: 90,
    createdAt: toISO(addDays(today, -2)),
    updatedAt: toISO(addDays(today, 0)),
  },
  {
    id: 'tsk_2',
    title: 'Reply to investor email',
    priority: 'urgent',
    status: 'todo',
    due: at(0, '12:00'),
    estimateMinutes: 20,
    createdAt: toISO(addDays(today, -1)),
    updatedAt: toISO(addDays(today, -1)),
  },
  {
    id: 'tsk_3',
    title: 'Read 1 chapter of "Deep Work"',
    priority: 'low',
    status: 'todo',
    due: at(0, '21:00'),
    estimateMinutes: 45,
    goalId: 'goal_study',
    createdAt: toISO(addDays(today, -3)),
    updatedAt: toISO(addDays(today, -1)),
  },
  {
    id: 'tsk_4',
    title: 'Plan weekend trip',
    priority: 'medium',
    status: 'todo',
    due: at(2, '20:00'),
    estimateMinutes: 30,
    createdAt: toISO(addDays(today, -1)),
    updatedAt: toISO(addDays(today, -1)),
  },
  {
    id: 'tsk_5',
    title: 'Morning stretches',
    priority: 'low',
    status: 'done',
    due: at(0, '08:00'),
    completedAt: toISO(addDays(today, 0)),
    goalId: 'goal_health',
    createdAt: toISO(addDays(today, -1)),
    updatedAt: toISO(addDays(today, 0)),
  },
  {
    id: 'tsk_6',
    title: 'Pay credit card bill',
    priority: 'high',
    status: 'done',
    completedAt: toISO(addDays(today, -1)),
    createdAt: toISO(addDays(today, -4)),
    updatedAt: toISO(addDays(today, -1)),
  },
  {
    id: 'tsk_7',
    title: 'Grocery shopping',
    priority: 'medium',
    status: 'todo',
    due: at(1, '18:00'),
    estimateMinutes: 45,
    createdAt: toISO(addDays(today, -1)),
    updatedAt: toISO(addDays(today, -1)),
  },
];

/* ------------------------------- Goals ---------------------------------- */

export const seedGoals: Goal[] = [
  {
    id: 'goal_health',
    title: 'Gym 3x / week',
    category: 'health',
    cadence: 'weekly',
    target: 3,
    unit: 'sessions',
    preferredDurationMinutes: 60,
    preferredWindow: { start: '07:00', end: '08:30' },
    color: '#22c55e',
    active: true,
    createdAt: toISO(addDays(today, -30)),
    updatedAt: toISO(addDays(today, -2)),
  },
  {
    id: 'goal_study',
    title: 'Study 5 hours / week',
    category: 'learning',
    cadence: 'weekly',
    target: 300,
    unit: 'minutes',
    preferredDurationMinutes: 60,
    preferredWindow: { start: '19:30', end: '21:30' },
    color: '#14b8a6',
    active: true,
    createdAt: toISO(addDays(today, -21)),
    updatedAt: toISO(addDays(today, -2)),
  },
  {
    id: 'goal_project',
    title: 'Side project 1 hour / day',
    category: 'focus',
    cadence: 'daily',
    target: 60,
    unit: 'minutes',
    preferredDurationMinutes: 60,
    preferredWindow: { start: '20:00', end: '22:00' },
    color: '#8b5cf6',
    active: true,
    createdAt: toISO(addDays(today, -14)),
    updatedAt: toISO(addDays(today, -3)),
  },
];

/* --------------------------- Activity logs ------------------------------ */

const yKey = dayKey(addDays(today, -1));

export const seedActivityLogs: ActivityLog[] = [
  // Yesterday's reflection entries
  {
    id: 'log_1',
    date: yKey,
    title: 'Work · Deep Hours',
    category: 'work',
    start: at(-1, '09:00'),
    end: at(-1, '12:10'),
    plannedMinutes: 210,
    actualMinutes: 190,
    status: 'completed',
    createdAt: toISO(addDays(today, -1)),
  },
  {
    id: 'log_2',
    date: yKey,
    title: 'Gym session',
    category: 'health',
    start: at(-1, '07:10'),
    end: at(-1, '08:00'),
    plannedMinutes: 60,
    actualMinutes: 50,
    status: 'completed',
    goalId: 'goal_health',
    createdAt: toISO(addDays(today, -1)),
  },
  {
    id: 'log_3',
    date: yKey,
    title: 'Study time',
    category: 'learning',
    start: at(-1, '20:00'),
    end: at(-1, '20:35'),
    plannedMinutes: 60,
    actualMinutes: 35,
    status: 'partial',
    goalId: 'goal_study',
    createdAt: toISO(addDays(today, -1)),
  },
  {
    id: 'log_4',
    date: yKey,
    title: 'Side project',
    category: 'focus',
    plannedMinutes: 60,
    actualMinutes: 0,
    status: 'missed',
    goalId: 'goal_project',
    createdAt: toISO(addDays(today, -1)),
    note: 'Got pulled into a call and ran out of time.',
  },
];

/* --------------------------- Phone usage -------------------------------- */

export const seedPhoneUsage: PhoneUsageDay[] = [
  {
    date: dayKey(addDays(today, -1)),
    totalScreenMinutes: 214,
    source: 'simulated',
    apps: [
      { packageName: 'com.instagram', appName: 'Instagram', category: 'social', minutes: 62 },
      { packageName: 'com.youtube', appName: 'YouTube', category: 'entertainment', minutes: 48 },
      { packageName: 'com.tiktok', appName: 'TikTok', category: 'entertainment', minutes: 35 },
      { packageName: 'com.slack', appName: 'Slack', category: 'productivity', minutes: 28 },
      { packageName: 'com.whatsapp', appName: 'WhatsApp', category: 'communication', minutes: 25 },
      { packageName: 'com.spotify', appName: 'Spotify', category: 'other', minutes: 16 },
    ],
  },
  {
    date: dayKey(addDays(today, -2)),
    totalScreenMinutes: 178,
    source: 'simulated',
    apps: [
      { packageName: 'com.youtube', appName: 'YouTube', category: 'entertainment', minutes: 52 },
      { packageName: 'com.instagram', appName: 'Instagram', category: 'social', minutes: 41 },
      { packageName: 'com.slack', appName: 'Slack', category: 'productivity', minutes: 31 },
      { packageName: 'com.whatsapp', appName: 'WhatsApp', category: 'communication', minutes: 30 },
      { packageName: 'com.spotify', appName: 'Spotify', category: 'other', minutes: 24 },
    ],
  },
];

/* --------------------------- Notifications ------------------------------ */

export const seedNotifications: AppNotification[] = [
  {
    id: 'ntf_1',
    kind: 'daily_plan',
    title: 'Plan your day',
    body: 'You have 5 tasks and 2 hours of free time today. Want a suggested plan?',
    createdAt: toISO(now),
    read: false,
    actionLabel: 'Generate plan',
  },
  {
    id: 'ntf_2',
    kind: 'upcoming_event',
    title: 'Dentist at 5:30 PM',
    body: 'Your dentist appointment is in a few hours at Bright Smile Clinic.',
    createdAt: toISO(now),
    read: false,
    actionLabel: 'View',
  },
  {
    id: 'ntf_3',
    kind: 'goal_alert',
    title: 'Side project slipped yesterday',
    body: 'You missed your 1h/day goal. I can find a slot this evening.',
    createdAt: toISO(now),
    read: true,
    actionLabel: 'Reschedule',
  },
];
