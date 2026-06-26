/**
 * Central Zustand store for LifeMate.
 *
 * State is split into logical slices (calendar, tasks, goals, etc.) but lives
 * in a single store so cross-slice operations (e.g. "turn a task into an
 * event") stay simple. Persistence is to localStorage so a refresh keeps the
 * user's data; the seed runs once on first load.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ActivityLog,
  AppNotification,
  Event,
  Goal,
  Insight,
  ISODate,
  PhoneUsageDay,
  Task,
  User,
} from '@/types/models';
import {
  seedActivityLogs,
  seedEvents,
  seedGoals,
  seedNotifications,
  seedPhoneUsage,
  seedTasks,
  seedUser,
} from '@/data/mockData';
import { uid } from '@/lib/utils';
import { toISO } from '@/lib/time';
import { detectConflict } from '@/lib/scheduler';

interface AppState {
  user: User;
  events: Event[];
  tasks: Task[];
  goals: Goal[];
  activityLogs: ActivityLog[];
  phoneUsage: PhoneUsageDay[];
  notifications: AppNotification[];
  insights: Insight[];

  /* ---- Calendar / events ---- */
  addEvent: (e: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Event;
  updateEvent: (id: string, patch: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  rescheduleEvent: (id: string, start: ISODate, end: ISODate) => { conflict: boolean };

  /* ---- Tasks ---- */
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Task['status'] }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  /* ---- Goals ---- */
  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  /* ---- Activity logs ---- */
  addActivityLog: (l: Omit<ActivityLog, 'id' | 'createdAt'>) => void;

  /* ---- Phone usage ---- */
  setPhoneUsage: (days: PhoneUsageDay[]) => void;

  /* ---- Notifications ---- */
  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotification: (id: string) => void;

  /* ---- Insights ---- */
  setInsights: (insights: Insight[]) => void;

  /* ---- User prefs ---- */
  updateUser: (patch: Partial<User>) => void;

  /* ---- Maintenance ---- */
  resetToSeed: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: seedUser,
      events: seedEvents,
      tasks: seedTasks,
      goals: seedGoals,
      activityLogs: seedActivityLogs,
      phoneUsage: seedPhoneUsage,
      notifications: seedNotifications,
      insights: [],

      addEvent: (e) => {
        const now = toISO(new Date());
        const event: Event = { ...e, id: uid('evt'), createdAt: now, updatedAt: now };
        set((s) => ({ events: [...s.events, event] }));
        return event;
      },

      updateEvent: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: toISO(new Date()) } : e,
          ),
        })),

      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      rescheduleEvent: (id, start, end) => {
        const ev = get().events.find((e) => e.id === id);
        if (!ev) return { conflict: false };
        // Only check against OTHER events; never auto-overwrite.
        const conflict = detectConflict(get().events, start, end, id);
        get().updateEvent(id, { start, end });
        return { conflict: conflict.hasConflict };
      },

      addTask: (t) => {
        const now = toISO(new Date());
        const task: Task = {
          ...t,
          status: t.status ?? 'todo',
          id: uid('tsk'),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task;
      },

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: toISO(new Date()) } : t,
          ),
        })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const done = t.status === 'done';
            return {
              ...t,
              status: done ? 'todo' : 'done',
              completedAt: done ? undefined : toISO(new Date()),
              updatedAt: toISO(new Date()),
            };
          }),
        })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addGoal: (g) => {
        const now = toISO(new Date());
        const goal: Goal = { ...g, id: uid('goal'), createdAt: now, updatedAt: now };
        set((s) => ({ goals: [...s.goals, goal] }));
        return goal;
      },

      updateGoal: (id, patch) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id ? { ...g, ...patch, updatedAt: toISO(new Date()) } : g,
          ),
        })),

      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addActivityLog: (l) =>
        set((s) => ({
          activityLogs: [
            { ...l, id: uid('log'), createdAt: toISO(new Date()) },
            ...s.activityLogs,
          ],
        })),

      setPhoneUsage: (days) => set({ phoneUsage: days }),

      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: uid('ntf'), createdAt: toISO(new Date()), read: false },
            ...s.notifications,
          ],
        })),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      clearNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      setInsights: (insights) => set({ insights }),

      updateUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),

      resetToSeed: () =>
        set({
          user: seedUser,
          events: seedEvents,
          tasks: seedTasks,
          goals: seedGoals,
          activityLogs: seedActivityLogs,
          phoneUsage: seedPhoneUsage,
          notifications: seedNotifications,
          insights: [],
        }),
    }),
    {
      name: 'lifemate-store-v1',
      // Only persist the data slices, not the actions.
      partialize: (s) => ({
        user: s.user,
        events: s.events,
        tasks: s.tasks,
        goals: s.goals,
        activityLogs: s.activityLogs,
        phoneUsage: s.phoneUsage,
        notifications: s.notifications,
        insights: s.insights,
      }),
    },
  ),
);
