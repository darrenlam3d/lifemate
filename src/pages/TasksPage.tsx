/**
 * Tasks — today / upcoming / completed lists with priority and due dates.
 *
 * Tasks can be created inline, completed with one tap, scheduled onto the
 * calendar via the AI assistant, and linked to goals.
 */
import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Circle,
  ListTodo,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Card, Badge, EmptyState, Segmented, Button } from '@/components/ui';
import { PRIORITY_META, Task, TaskPriority } from '@/types/models';
import { fmtTime, fromISO, relativeDayLabel, plusMinutes } from '@/lib/time';
import { cn } from '@/lib/utils';

interface TasksPageProps {
  onScheduleTask: (prompt: string) => void;
}

type Tab = 'today' | 'upcoming' | 'completed';

export function TasksPage({ onScheduleTask }: TasksPageProps) {
  const { tasks, goals, toggleTask, addTask, deleteTask } = useAppStore();
  const [tab, setTab] = useState<Tab>('today');
  const [draft, setDraft] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const now = useMemo(() => new Date(), []);
  const endOfToday = plusMinutes(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), 24 * 60);

  const grouped = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done');
    const today = open
      .filter((t) => !t.due || fromISO(t.due) <= fromISO(endOfToday))
      .sort(byPriorityThenDue);
    const upcoming = open
      .filter((t) => t.due && fromISO(t.due) > fromISO(endOfToday))
      .sort(byPriorityThenDue);
    const completed = tasks
      .filter((t) => t.status === 'done')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return { today, upcoming, completed };
  }, [tasks, endOfToday]);

  const list = grouped[tab];

  function handleAdd() {
    const title = draft.trim();
    if (!title) return;
    addTask({
      title,
      priority,
      status: 'todo',
      due: tab === 'today' ? endOfToday : undefined,
    });
    setDraft('');
  }

  return (
    <div className="flex h-full flex-col px-4 pb-28 pt-2">
      <header className="safe-top pt-2">
        <h1 className="text-xl font-extrabold text-slate-900">Tasks</h1>
        <p className="text-xs text-slate-400">
          {grouped.today.length} today · {grouped.upcoming.length} upcoming · {grouped.completed.length} done
        </p>
      </header>

      <div className="mt-3">
        <Segmented
          options={[
            { value: 'today', label: 'Today' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'completed', label: 'Done' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          className="w-full"
        />
      </div>

      {/* Quick add */}
      <Card className="mt-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add a task…"
            className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
          <Button size="sm" onClick={handleAdd} disabled={!draft.trim()}>
            <Plus size={14} /> Add
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Priority:</span>
          {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cn(
                'pill transition',
                priority === p ? 'ring-2 ring-offset-1' : 'opacity-70',
              )}
              style={{
                backgroundColor: `${PRIORITY_META[p].color}1a`,
                color: PRIORITY_META[p].color,
                ...(priority === p ? { boxShadow: `0 0 0 2px ${PRIORITY_META[p].color}` } : {}),
              }}
            >
              {PRIORITY_META[p].label}
            </button>
          ))}
        </div>
      </Card>

      {/* List */}
      <div className="mt-4 flex-1 overflow-y-auto">
        {list.length > 0 ? (
          <div className="space-y-2">
            {list.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                goalTitle={goals.find((g) => g.id === t.goalId)?.title}
                onToggle={() => toggleTask(t.id)}
                onDelete={() => deleteTask(t.id)}
                onSchedule={() =>
                  onScheduleTask(
                    `Schedule ${t.title}${t.estimateMinutes ? ` for ${t.estimateMinutes} minutes` : ''} today`,
                  )
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ListTodo}
            title={tab === 'completed' ? 'No completed tasks yet' : 'No tasks here'}
            description={tab === 'today' ? 'Add one above, or ask the AI assistant.' : undefined}
          />
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  goalTitle,
  onToggle,
  onDelete,
  onSchedule,
}: {
  task: Task;
  goalTitle?: string;
  onToggle: () => void;
  onDelete: () => void;
  onSchedule: () => void;
}) {
  const done = task.status === 'done';
  const meta = PRIORITY_META[task.priority];
  return (
    <Card compact className={cn('p-0', done && 'opacity-60')}>
      <div className="flex items-center gap-3 p-3.5">
        <button onClick={onToggle} aria-label="Toggle complete">
          {done ? (
            <CheckCircle2 size={20} className="text-emerald-500" />
          ) : (
            <Circle size={20} className="text-slate-300" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium text-slate-800', done && 'line-through')}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge color={meta.color} dot>
              {meta.label}
            </Badge>
            {task.due && (
              <Badge className="bg-slate-100 text-slate-500">
                {relativeDayLabel(task.due)} {fmtTime(task.due)}
              </Badge>
            )}
            {goalTitle && <Badge className="bg-violet-50 text-violet-600">🎯 {goalTitle}</Badge>}
          </div>
        </div>
        {!done && (
          <button
            onClick={onSchedule}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-brand-50 hover:text-brand-600"
            aria-label="Schedule"
            title="Schedule on calendar"
          >
            <CalendarPlus size={16} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Card>
  );
}

/* ------------------------------ helpers --------------------------------- */

function byPriorityThenDue(a: Task, b: Task): number {
  const pa = PRIORITY_META[a.priority].rank;
  const pb = PRIORITY_META[b.priority].rank;
  if (pa !== pb) return pa - pb;
  return (a.due ?? '').localeCompare(b.due ?? '');
}
