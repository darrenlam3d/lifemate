/**
 * Goal progress helpers.
 *
 * Computes how much of a goal has been completed in the current cadence
 * period using completed tasks and activity logs. Used by Home, Goals and
 * Insights screens.
 */
import { addDays, startOfWeek } from 'date-fns';
import { ActivityLog, Goal, Task } from '@/types/models';
import { dayKey, fromISO } from '@/lib/time';

export interface GoalProgress {
  goal: Goal;
  /** Amount completed in the current period (sessions or minutes). */
  done: number;
  /** Target amount for the current period. */
  target: number;
  /** 0..1 fraction. */
  fraction: number;
  /** Whether the user is falling behind for this period. */
  atRisk: boolean;
}

/** Period [start, end) for a goal's cadence, anchored to "now". */
export function goalPeriod(goal: Goal, now: Date): { start: Date; end: Date } {
  if (goal.cadence === 'daily') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end: addDays(start, 1) };
  }
  if (goal.cadence === 'weekly') {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return { start, end: addDays(start, 7) };
  }
  // monthly
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

export function computeGoalProgress(
  goal: Goal,
  tasks: Task[],
  logs: ActivityLog[],
  now: Date,
): GoalProgress {
  const { start, end } = goalPeriod(goal, now);
  const startISO = start.toISOString();

  // Count completed tasks linked to this goal within the period.
  const taskCount = tasks.filter(
    (t) =>
      t.goalId === goal.id &&
      t.status === 'done' &&
      t.completedAt &&
      t.completedAt >= startISO &&
      fromISO(t.completedAt) < end,
  ).length;

  // Count activity logs linked to this goal within the period.
  const logMinutes = logs
    .filter(
      (l) =>
        l.goalId === goal.id &&
        l.actualMinutes &&
        fromISO(`${l.date}T00:00:00`) >= start &&
        fromISO(`${l.date}T00:00:00`) < end,
    )
    .reduce((s, l) => s + (l.actualMinutes ?? 0), 0);

  const taskMinutes = tasks
    .filter(
      (t) =>
        t.goalId === goal.id &&
        t.status === 'done' &&
        t.completedAt &&
        t.completedAt >= startISO &&
        fromISO(t.completedAt) < end,
    )
    .reduce((s, t) => s + (t.estimateMinutes ?? goal.preferredDurationMinutes), 0);

  let done = 0;
  if (goal.unit === 'sessions') {
    const logSessions = logs.filter(
      (l) =>
        l.goalId === goal.id &&
        l.actualMinutes &&
        l.actualMinutes > 0 &&
        fromISO(`${l.date}T00:00:00`) >= start &&
        fromISO(`${l.date}T00:00:00`) < end,
    ).length;
    done = taskCount + logSessions;
  } else {
    done = taskMinutes + logMinutes;
  }

  const target = goal.target;
  const fraction = target > 0 ? Math.min(1, done / target) : 0;

  // At-risk heuristic: for weekly goals, by Thursday you should be past ~50%.
  let atRisk = false;
  if (goal.cadence === 'weekly') {
    const dayOfWeek = now.getDay();
    const expectedFraction = clamp01(dayOfWeek / 7);
    atRisk = fraction < expectedFraction - 0.15;
  } else if (goal.cadence === 'daily') {
    const hour = now.getHours();
    const expectedFraction = clamp01(hour / 17); // by ~5pm
    atRisk = fraction < expectedFraction - 0.2;
  }

  return { goal, done, target, fraction, atRisk };
}

export function computeAllGoalProgress(
  goals: Goal[],
  tasks: Task[],
  logs: ActivityLog[],
  now: Date,
): GoalProgress[] {
  return goals.filter((g) => g.active).map((g) => computeGoalProgress(g, tasks, logs, now));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export { dayKey };
