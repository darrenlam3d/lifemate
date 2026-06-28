/**
 * SimpleHome — the focused daily view.
 *
 * Only what you need: today's date, the next thing on your calendar, today's
 * tasks (tap to complete), and your goals with inline create/edit/delete.
 */
import { useMemo, useState } from 'react';
import {
  Check,
  Circle,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useNow } from '@/hooks/useNow';
import { Card, Button, Modal, Segmented } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import {
  Goal,
  GoalCadence,
  EventCategory,
  CATEGORY_META,
  PRIORITY_META,
} from '@/types/models';
import { computeAllGoalProgress } from '@/lib/goals';
import {
  fmtDate,
  fmtTime,
  fromISO,
  greeting,
  minutesBetween,
} from '@/lib/time';
import { cn } from '@/lib/utils';

export function SimpleHome() {
  const now = useNow();
  const {
    user,
    events,
    tasks,
    goals,
    activityLogs,
    toggleTask,
    addTask,
    deleteTask,
    addGoal,
    updateGoal,
    deleteGoal,
  } = useAppStore();

  const [goalEditing, setGoalEditing] = useState<Goal | 'new' | null>(null);

  // Today's tasks, ordered by priority.
  const todayTasks = useMemo(() => {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    return tasks
      .filter((t) => t.status !== 'done' && (!t.due || fromISO(t.due) <= endOfToday))
      .sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank);
  }, [tasks, now]);

  // Next upcoming event.
  const nextEvent = useMemo(() => {
    return events
      .filter((e) => fromISO(e.end) > now && !e.recurrence)
      .concat(
        events.filter((e) => {
          if (!e.recurrence) return false;
          const start = fromISO(e.start);
          const dStart = new Date(now);
          dStart.setHours(0, 0, 0, 0);
          const dEnd = new Date(dStart);
          dEnd.setDate(dEnd.getDate() + 1);
          return start < dEnd;
        }),
      )
      .filter((e) => fromISO(e.end) > now)
      .sort((a, b) => fromISO(a.start).getTime() - fromISO(b.start).getTime())[0];
  }, [events, now]);

  const goalProgress = useMemo(
    () => computeAllGoalProgress(goals, tasks, activityLogs, now),
    [goals, tasks, activityLogs, now],
  );

  const completedToday = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && fromISO(t.completedAt) > startOfToday(now),
  ).length;

  const [quickTask, setQuickTask] = useState('');

  function addQuickTask() {
    if (!quickTask.trim()) return;
    addTask({ title: quickTask.trim(), priority: 'medium', status: 'todo' });
    setQuickTask('');
  }

  return (
    <div className="space-y-5 px-4 pb-28 pt-2">
      {/* Header */}
      <header className="safe-top flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {fmtDate(now)}
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {greeting()}, {user.name}
          </h1>
        </div>
        <Avatar name={user.name} color={user.avatarColor} size={40} />
      </header>

      {/* Progress strip */}
      <div className="flex gap-2">
        <Card compact className="flex-1 py-3">
          <p className="text-2xl font-extrabold text-slate-900">{todayTasks.length}</p>
          <p className="text-xs text-slate-400">to do</p>
        </Card>
        <Card compact className="flex-1 py-3">
          <p className="text-2xl font-extrabold text-emerald-500">{completedToday}</p>
          <p className="text-xs text-slate-400">done today</p>
        </Card>
        <Card compact className="flex-1 py-3">
          <p className="text-2xl font-extrabold text-brand-600">{goalProgress.length}</p>
          <p className="text-xs text-slate-400">active goals</p>
        </Card>
      </div>

      {/* Next up */}
      {nextEvent && (
        <section>
          <h2 className="mb-2 section-title">Next up</h2>
          <Card compact className="flex items-center gap-3 py-3.5">
            <span
              className="h-10 w-1.5 rounded-full"
              style={{ backgroundColor: CATEGORY_META[nextEvent.category].color }}
            />
            <div className="flex-1">
              <p className="font-bold text-slate-900">{nextEvent.title}</p>
              <p className="text-xs text-slate-400">
                {fmtTime(nextEvent.start)} · in {Math.max(0, Math.round(minutesBetween(now, nextEvent.start) / 60))} min
              </p>
            </div>
          </Card>
        </section>
      )}

      {/* Today's tasks */}
      <section>
        <h2 className="mb-2 section-title">Today</h2>

        {/* Quick add */}
        <Card compact className="mb-2">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-slate-400" />
            <input
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addQuickTask()}
              placeholder="Add a task…"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300"
            />
            {quickTask && (
              <button onClick={addQuickTask} className="text-xs font-semibold text-brand-600">
                Add
              </button>
            )}
          </div>
        </Card>

        {todayTasks.length > 0 ? (
          <Card className="divide-y divide-slate-100 p-0">
            {todayTasks.map((t) => (
              <div key={t.id} className="group flex items-center gap-3 p-3.5">
                <button onClick={() => toggleTask(t.id)} aria-label="Complete">
                  <Circle size={18} className="text-slate-300" />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{t.title}</p>
                </div>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_META[t.priority].color }}
                />
                <button
                  onClick={() => deleteTask(t.id)}
                  className="text-slate-300 transition hover:text-rose-500"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </Card>
        ) : (
          <Card compact>
            <p className="py-2 text-center text-sm text-slate-400">Nothing to do. Enjoy the calm. ✨</p>
          </Card>
        )}
      </section>

      {/* Goals with inline CRUD */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Goals</h2>
          <button
            onClick={() => setGoalEditing('new')}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        {goalProgress.length > 0 ? (
          <div className="space-y-2">
            {goalProgress.map(({ goal, done, target, fraction }) => (
              <Card key={goal.id} compact className="p-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${goal.color}1a` }}
                  >
                    <Target size={15} style={{ color: goal.color }} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{goal.title}</p>
                    <p className="text-xs text-slate-400">
                      {done}/{target}
                      {goal.unit === 'minutes' ? 'm' : 'x'} · {goal.cadence}
                    </p>
                  </div>
                  <button
                    onClick={() => setGoalEditing(goal)}
                    className="text-slate-300 transition hover:text-brand-600"
                    aria-label="Edit goal"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-slate-300 transition hover:text-rose-500"
                    aria-label="Delete goal"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${fraction * 100}%`, backgroundColor: goal.color }}
                  />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card compact>
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Target size={24} className="text-slate-300" />
              <p className="text-sm text-slate-400">No goals yet. Add one to get started.</p>
              <Button size="sm" onClick={() => setGoalEditing('new')}>
                <Plus size={13} /> New goal
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* Goal editor (shared create/edit) */}
      <GoalEditor
        open={goalEditing !== null}
        goal={goalEditing === 'new' ? undefined : goalEditing ?? undefined}
        onClose={() => setGoalEditing(null)}
        onSave={(data) => {
          if (goalEditing === 'new') {
            addGoal(data);
          } else if (goalEditing) {
            updateGoal(goalEditing.id, data);
          }
          setGoalEditing(null);
        }}
      />
    </div>
  );
}

/* --------------------------- Goal editor -------------------------------- */

function GoalEditor({
  open,
  goal,
  onClose,
  onSave,
}: {
  open: boolean;
  goal?: Goal;
  onClose: () => void;
  onSave: (data: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [cadence, setCadence] = useState<GoalCadence>(goal?.cadence ?? 'weekly');
  const [target, setTarget] = useState(goal?.target ?? 3);
  const [unit, setUnit] = useState<'sessions' | 'minutes'>(goal?.unit ?? 'sessions');
  const [category, setCategory] = useState<EventCategory>(goal?.category ?? 'health');

  // Sync state when the target goal changes.
  const key = goal?.id ?? 'new';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setTitle(goal?.title ?? '');
    setCadence(goal?.cadence ?? 'weekly');
    setTarget(goal?.target ?? 3);
    setUnit(goal?.unit ?? 'sessions');
    setCategory(goal?.category ?? 'health');
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      cadence,
      target,
      unit,
      category,
      preferredDurationMinutes: goal?.preferredDurationMinutes ?? 60,
      preferredWindow: goal?.preferredWindow ?? { start: '07:00', end: '09:00' },
      color: CATEGORY_META[category].color,
      active: true,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          <Button fullWidth onClick={save} disabled={!title.trim()}>
            <Check size={14} /> Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <L label="Goal title">
          <input
            className="lm-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gym 3x/week"
            autoFocus
          />
        </L>
        <L label="How often">
          <Segmented
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            value={cadence}
            onChange={(v) => setCadence(v as GoalCadence)}
            className="w-full"
          />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Target">
            <input
              type="number"
              min={1}
              className="lm-input"
              value={target}
              onChange={(e) => setTarget(Math.max(1, +e.target.value))}
            />
          </L>
          <L label="Count by">
            <Segmented
              options={[
                { value: 'sessions', label: 'Sessions' },
                { value: 'minutes', label: 'Minutes' },
              ]}
              value={unit}
              onChange={(v) => setUnit(v as 'sessions' | 'minutes')}
              className="w-full"
            />
          </L>
        </div>
        <L label="Category">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as EventCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn('pill', category === cat && 'ring-2')}
                style={{
                  backgroundColor: `${CATEGORY_META[cat].color}1a`,
                  color: CATEGORY_META[cat].color,
                  ...(category === cat ? { boxShadow: `0 0 0 2px ${CATEGORY_META[cat].color}` } : {}),
                }}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        </L>
      </div>

      <style>{`
        .lm-input { width:100%; border-radius:.75rem; border:1px solid #e2e8f0; background:#fff; padding:.6rem .75rem; font-size:.9rem; outline:none; }
        .lm-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
      `}</style>
    </Modal>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
