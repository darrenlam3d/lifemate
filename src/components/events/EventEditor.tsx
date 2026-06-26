import { FormEvent, useState } from 'react';
import { Event, EventCategory, CATEGORY_META } from '@/types/models';
import { Modal } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { fromISO, toISO, plusMinutes, fmtTime } from '@/lib/time';
import { detectConflict } from '@/lib/scheduler';
import { useAppStore } from '@/store/useAppStore';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventEditorProps {
  open: boolean;
  onClose: () => void;
  /** Existing event to edit; omit to create. */
  event?: Event;
  /** Pre-filled defaults (e.g. when AI suggested a slot). */
  defaults?: Partial<Event>;
}

function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = fromISO(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventEditor({ open, onClose, event, defaults }: EventEditorProps) {
  const { addEvent, updateEvent, events } = useAppStore();

  const [title, setTitle] = useState(event?.title ?? defaults?.title ?? '');
  const [startInput, setStartInput] = useState(
    toLocalInput(event?.start ?? defaults?.start),
  );
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState<EventCategory>(
    event?.category ?? defaults?.category ?? 'other',
  );
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [protectedFlag, setProtectedFlag] = useState(
    event?.protected ?? CATEGORY_META[category].protectedByDefault,
  );

  // Validate against conflicts live.
  const conflictMsg = (() => {
    if (!startInput) return null;
    const s = toISO(new Date(startInput));
    const e = plusMinutes(s, duration);
    const res = detectConflict(events, s, e, event?.id);
    if (!res.hasConflict) return null;
    return `Overlaps with "${res.overlapping[0].title}" (${fmtTime(res.overlapping[0].start)})`;
  })();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startInput) return;
    const s = toISO(new Date(startInput));
    const end = plusMinutes(s, duration);
    const payload = {
      title: title.trim(),
      start: s,
      end,
      category,
      protected: protectedFlag,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (event) {
      updateEvent(event.id, payload);
    } else {
      addEvent(payload);
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={(e) => handleSubmit(e as unknown as FormEvent)}
            disabled={!title.trim() || !startInput}
          >
            {event ? 'Save' : 'Add event'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gym session"
            autoFocus
          />
        </Field>

        <Field label="When">
          <input
            type="datetime-local"
            className="input"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
          />
        </Field>

        <Field label="Duration">
          <div className="flex flex-wrap gap-2">
            {[30, 60, 90, 120].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  duration === d
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {d < 60 ? `${d}m` : d % 60 === 0 ? `${d / 60}h` : `${d}m`}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_META) as EventCategory[]).map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'pill transition',
                  category === cat ? 'ring-2 ring-offset-1' : 'opacity-70',
                )}
                style={{
                  backgroundColor: `${CATEGORY_META[cat].color}1a`,
                  color: CATEGORY_META[cat].color,
                  ...(category === cat
                    ? { boxShadow: `0 0 0 2px ${CATEGORY_META[cat].color}` }
                    : {}),
                }}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Location (optional)">
          <input
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Downtown gym"
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            className="input min-h-[64px] resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember…"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={protectedFlag}
            onChange={(e) => setProtectedFlag(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-600"
          />
          Protect this block (AI won't auto-move it)
        </label>

        {conflictMsg && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{conflictMsg}. I won't overwrite it — confirm anyway?</span>
          </div>
        )}
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: #fff;
          padding: 0.625rem 0.75rem;
          font-size: 0.9rem;
          color: #0f172a;
          outline: none;
        }
        .input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
      `}</style>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
