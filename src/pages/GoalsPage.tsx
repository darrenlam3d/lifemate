/**
 * Goals — repeating-goal planner with AI distribution.
 *
 * Users set goals (e.g. gym 3x/week). The page shows per-period progress and
 * lets the AI auto-distribute the goals into open time blocks. Distribution is
 * always shown as *proposed* blocks first — the user confirms before any
 * calendar changes are made.
 */
import { useMemo, useState } from 'react';
import {
  Check,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Card, Badge, Button, EmptyState, Modal } from '@/components/ui';
import { Goal, GoalCadence, EventCategory, CATEGORY_META } from '@/types/models';
import { distributeGoals, GoalPlacement } from '@/lib/scheduler';
import { computeAllGoalProgress } from '@/lib/goals';
import { cadenceLabel, fmtDay, fmtTime } from '@/lib/time';
import { cn, formatDuration } from '@/lib/utils';

interface GoalsPageProps {
  onOpenAssistant: (prompt: string) => void;
}

export function GoalsPage({ onOpenAssistant }: GoalsPageProps) {
  const { goals, tasks, activityLogs, events, user, addGoal, deleteGoal, addEvent, updateGoal } = useAppStore();
  const now = useMemo(() => new Date(), []);

  const progress = useMemo(
    () => computeAllGoalProgress(goals, tasks, activityLogs, now),
    [goals, tasks, activityLogs, now],
  );

  const [creating, setCreating] = useState(false);
  const [distribution, setDistribution] = useState<GoalPlacement[] | null>(null);

  function runDistribution() {
    const result = distributeGoals(now, events, goals.filter((g) => g.active), user);
    setDistribution(result.placements);
  }

  function confirmPlacement(p: GoalPlacement) {
    // Commit each proposed block as a real (non-protected) event.
    p.blocks.forEach((b) => {
      addEvent({
        title: p.title,
        start: b.start,
        end: b.end,
        category: p.category,
        protected: false,
      });
    });
    setDistribution((cur) => (cur ?? []).filter((x) => x.goalId !== p.goalId));
  }

  return (
    <div className="flex h-full flex-col px-4 pb-28 pt-2">
      <header className="safe-top flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Goals</h1>
          <p className="text-xs text-slate-400">Repeating habits the AI keeps on track</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New
        </Button>
      </header>

      {/* AI distribute CTA */}
      <button
        onClick={runDistribution}
        className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-left transition active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Wand2 size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-brand-800">Auto-fit goals into free time</p>
          <p className="text-xs text-brand-600/80">I'll find open slots without touching sleep, work or fixed events.</p>
        </div>
      </button>

      {/* Goal list */}
      <div className="mt-4 flex-1 overflow-y-auto">
        {progress.length > 0 ? (
          <div className="space-y-3">
            {progress.map(({ goal, done, target, fraction, atRisk }) => (
              <Card key={goal.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${goal.color}1a` }}>
                      <Target size={16} style={{ color: goal.color }} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{goal.title}</p>
                      <p className="text-xs text-slate-400">
                        {goal.target}
                        {goal.unit === 'minutes' ? 'm' : 'x'}
                        {cadenceLabel(goal.cadence)} · {goal.preferredDurationMinutes}m/session
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                    aria-label="Delete goal"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">
                    {done}
                    {goal.unit === 'minutes' ? 'm' : 'x'} of {target}
                    {goal.unit === 'minutes' ? 'm' : 'x'}
                  </span>
                  {atRisk ? (
                    <Badge className="bg-amber-50 text-amber-600">⚠ Behind</Badge>
                  ) : fraction >= 1 ? (
                    <Badge className="bg-emerald-50 text-emerald-600">On target</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500">{Math.round(fraction * 100)}%</Badge>
                  )}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, backgroundColor: goal.color }} />
                </div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" fullWidth onClick={() => onOpenAssistant(`Schedule ${goal.title} this week`)}>
                    <Sparkles size={13} /> Find a slot
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => updateGoal(goal.id, { active: !goal.active })}>
                    {goal.active ? 'Pause' : 'Resume'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set a repeating goal like “gym 3x/week” and let the AI find time for it."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} /> Add a goal
              </Button>
            }
          />
        )}
      </div>

      {/* Distribution confirmation sheet */}
      <Modal open={!!distribution} onClose={() => setDistribution(null)} title="Proposed goal schedule">
        {distribution && distribution.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Here's where your goals can fit. Sleep, work and fixed events are protected. Tap to confirm — nothing is booked yet.
            </p>
            {distribution.map((p) => (
              <Card key={p.goalId} compact>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-bold text-slate-800">{p.title}</span>
                  </div>
                  <span className={cn('text-xs font-semibold', p.fullyScheduled ? 'text-emerald-600' : 'text-amber-600')}>
                    {p.scheduledAmount}
                    {unitOf(p.goalId)}/{p.targetAmount}
                    {unitOf(p.goalId)}
                  </span>
                </div>
                {p.blocks.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {p.blocks.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {fmtDay(b.start)} · {fmtTime(b.start)}
                        </span>
                        <span>· {formatDuration(Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-amber-600">No open slots fit this goal's window. Try widening the time.</p>
                )}
                <Button size="sm" fullWidth className="mt-2" disabled={p.blocks.length === 0} onClick={() => confirmPlacement(p)}>
                  <Check size={14} /> Confirm {p.blocks.length} block{p.blocks.length === 1 ? '' : 's'}
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={Sparkles} title="Nothing to schedule" description="All your goals already fit, or there's no free time this week." />
        )}
      </Modal>

      <GoalCreator open={creating} onClose={() => setCreating(false)} onCreate={(g) => addGoal(g)} />
    </div>
  );
}

/* --------------------------- Goal creator ------------------------------- */

function GoalCreator({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<GoalCadence>('weekly');
  const [target, setTarget] = useState(3);
  const [unit, setUnit] = useState<'sessions' | 'minutes'>('sessions');
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState<EventCategory>('health');
  const [winStart, setWinStart] = useState('07:00');
  const [winEnd, setWinEnd] = useState('09:00');

  function submit() {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      category,
      cadence,
      target,
      unit,
      preferredDurationMinutes: duration,
      preferredWindow: { start: winStart, end: winEnd },
      color: CATEGORY_META[category].color,
      active: true,
    });
    setTitle('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New goal"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          <Button fullWidth onClick={submit} disabled={!title.trim()}>
            <Check size={14} /> Create
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <L label="Goal title">
          <input className="lm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gym 3x/week" autoFocus />
        </L>
        <L label="How often">
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as GoalCadence[]).map((c) => (
              <button key={c} onClick={() => setCadence(c)} className={cn('chip', cadence === c && 'chip-on')}>
                {c}
              </button>
            ))}
          </div>
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Target">
            <input type="number" min={1} className="lm-input" value={target} onChange={(e) => setTarget(Math.max(1, +e.target.value))} />
          </L>
          <L label="Count by">
            <div className="flex gap-2">
              {(['sessions', 'minutes'] as const).map((u) => (
                <button key={u} onClick={() => setUnit(u)} className={cn('chip', unit === u && 'chip-on')}>
                  {u === 'sessions' ? 'Sessions' : 'Minutes'}
                </button>
              ))}
            </div>
          </L>
        </div>
        <L label="Minutes per session">
          <input type="number" min={5} step={5} className="lm-input" value={duration} onChange={(e) => setDuration(Math.max(5, +e.target.value))} />
        </L>
        <L label="Category">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as EventCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn('pill', category === cat && 'ring-2')}
                style={{ backgroundColor: `${CATEGORY_META[cat].color}1a`, color: CATEGORY_META[cat].color }}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Preferred from">
            <input type="time" className="lm-input" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
          </L>
          <L label="Preferred to">
            <input type="time" className="lm-input" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
          </L>
        </div>
      </div>

      <style>{`
        .lm-input { width:100%; border-radius:.75rem; border:1px solid #e2e8f0; background:#fff; padding:.55rem .75rem; font-size:.9rem; outline:none; }
        .lm-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
        .chip { border-radius:.6rem; padding:.4rem .7rem; font-size:.75rem; font-weight:600; background:#f1f5f9; color:#475569; }
        .chip-on { background:#6366f1; color:#fff; }
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

/** Look up a goal's unit short-form ("m" or "x") for display. */
function unitOf(goalId: string): string {
  // We don't import goals here to avoid a circular ref; infer from the live store.
  const g = useAppStore.getState().goals.find((x) => x.id === goalId);
  return g?.unit === 'minutes' ? 'm' : 'x';
}
