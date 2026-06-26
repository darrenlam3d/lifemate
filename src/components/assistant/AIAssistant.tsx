/**
 * AIAssistant — the conversational scheduling surface.
 *
 * Flow:
 *  1. User types or speaks a request.
 *  2. We call AIService.parse() to get an AIDraft (intent + reasoning).
 *  3. If essential info is missing, we ask ONE focused follow-up.
 *  4. If slots are suggested, the user taps one to confirm → we create the
 *     event/task. We never overwrite existing events without confirmation.
 *
 * The component renders as a bottom sheet so it stays mobile-first.
 */
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarPlus,
  Check,
  Clock,
  Mic,
  Send,
  Sparkles,
} from 'lucide-react';
import { Modal, Badge } from '@/components/ui';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { getAIService, AIDraft, AIContext } from '@/services/AIService';
import { useAppStore } from '@/store/useAppStore';
import { CATEGORY_META } from '@/types/models';
import { fmtDay, fmtTime, plusMinutes, toISO } from '@/lib/time';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  draft?: AIDraft;
}

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the input (e.g. tapped "Plan my day"). */
  initialPrompt?: string;
}

const SUGGESTIONS = [
  'Gym tomorrow at 7am',
  'Add study time this week',
  'Find 1 hour of free time tomorrow',
  'Plan my day',
];

export function AIAssistant({ open, onClose, initialPrompt }: AIAssistantProps) {
  const { user, events, tasks, goals } = useAppStore();
  const addEvent = useAppStore((s) => s.addEvent);
  const addTask = useAppStore((s) => s.addTask);
  const pushNotification = useAppStore((s) => s.pushNotification);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: "Hi! I'm your scheduling assistant. Tell me what you want to do — like “gym tomorrow at 7” or “add study time this week”. I'll find the right spot.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Seed from an external prompt (e.g. a Home-screen button).
  useEffect(() => {
    if (open && initialPrompt) {
      setInput(initialPrompt);
      run(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  const voice = useVoiceInput({
    onFinal: (text) => {
      setInput(text);
      run(text);
    },
  });

  function buildCtx(): AIContext {
    return { user, events, tasks, goals, now: new Date() };
  }

  async function run(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: Message = { id: mid(), role: 'user', text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const draft = await getAIService().parse(trimmed, buildCtx());
      const aiMsg: Message = {
        id: mid(),
        role: 'ai',
        text: draft.explanation,
        draft,
      };
      setMessages((m) => [...m, aiMsg]);
      if (draft.followUp) {
        setMessages((m) => [...m, { id: mid(), role: 'ai', text: draft.followUp!.question }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { id: mid(), role: 'ai', text: 'Sorry, I had trouble understanding that. Could you rephrase?' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function applyDraft(draft: AIDraft) {
    if (draft.intent === 'create_task' && draft.title) {
      addTask({
        title: draft.title,
        priority: 'medium',
        category: draft.category,
        due: draft.dayOffset !== undefined ? toISO(dayOffsetDate(draft.dayOffset)) : undefined,
      } as any);
      confirm(`${draft.title} added to your tasks.`);
    } else if (draft.intent === 'plan_day') {
      confirm('Opening your plan for today — head to the Home tab to review it.');
    }
  }

  function bookSlot(draft: AIDraft, start: string, reason: string) {
    const dur = draft.durationMinutes ?? 60;
    const end = plusMinutes(start, dur);
    addEvent({
      title: draft.title ?? 'Event',
      start,
      end,
      category: draft.category ?? 'other',
      protected: false,
    });
    pushNotification({
      kind: 'ai_message',
      title: 'Booked by assistant',
      body: `${draft.title} on ${fmtDay(start)} at ${fmtTime(start)}. ${reason}`,
      actionLabel: 'View',
    });
    confirm(`Booked “${draft.title}” on ${fmtDay(start)} at ${fmtTime(start)}.`);
    setMessages((m) => [
      ...m,
      { id: mid(), role: 'ai', text: `Done — booked ${fmtDay(start)} at ${fmtTime(start)}. ✅` },
    ]);
  }

  function confirm(text: string) {
    setMessages((m) => [...m, { id: mid(), role: 'ai', text }]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(input);
  }

  return (
    <Modal open={open} onClose={onClose} title="AI Assistant">
      <div className="flex h-[60vh] flex-col">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onApply={applyDraft} onBook={bookSlot} busy={busy} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Sparkles size={14} className="animate-pulse-soft" /> Thinking…
            </div>
          )}
        </div>

        {/* Voice error */}
        {voice.error && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{voice.error}</span>
          </div>
        )}
        {voice.listening && (
          <div className="mt-2 rounded-xl bg-brand-50 p-2.5 text-xs text-brand-700">
            Listening… {voice.transcript && <span className="italic">“{voice.transcript}”</span>}
          </div>
        )}

        {/* Quick suggestions */}
        {messages.length <= 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => run(s)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={voice.listening ? voice.stop : voice.start}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition',
              voice.listening
                ? 'bg-rose-500 text-white animate-pulse-soft'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
            )}
            aria-label="Voice input"
            title={voice.supported ? 'Speak' : 'Voice not supported here'}
          >
            <Mic size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to schedule something…"
            className="h-11 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </Modal>
  );
}

/* ------------------------------ Subviews -------------------------------- */

function MessageBubble({
  message,
  onApply,
  onBook,
  busy,
}: {
  message: Message;
  onApply: (d: AIDraft) => void;
  onBook: (d: AIDraft, start: string, reason: string) => void;
  busy: boolean;
}) {
  const isUser = message.role === 'user';
  const d = message.draft;

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
          isUser
            ? 'rounded-br-md bg-brand-600 text-white'
            : 'rounded-bl-md bg-slate-100 text-slate-800',
        )}
      >
        {!isUser && !d && <Sparkles size={13} className="mb-1 inline text-brand-400" />}
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

        {/* Conflicts */}
        {d?.conflicts && d.conflicts.length > 0 && (
          <div className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            {d.conflicts.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Clock size={12} /> {c.title} · {fmtTime(c.start)}
              </div>
            ))}
          </div>
        )}

        {/* Slot suggestions */}
        {d?.suggestions && d.suggestions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {d.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onBook(d, s.start, s.reason)}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs transition hover:border-brand-300 hover:shadow-sm disabled:opacity-50"
              >
                <CalendarPlus size={14} className="shrink-0 text-brand-500" />
                <span className="flex-1">
                  <span className="font-semibold text-slate-800">
                    {fmtDay(s.start)} · {fmtTime(s.start)}
                  </span>
                  <span className="block text-slate-400">{s.reason}</span>
                </span>
                <Check size={14} className="text-brand-500" />
              </button>
            ))}
          </div>
        )}

        {/* Apply-as-task action */}
        {d?.intent === 'create_task' && d.ready && (
          <button
            onClick={() => onApply(d)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Check size={12} /> Add as task
          </button>
        )}

        {/* Category badge for context */}
        {d?.category && (
          <div className="mt-2">
            <Badge color={CATEGORY_META[d.category].color} dot>
              {CATEGORY_META[d.category].label}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ helpers --------------------------------- */

function mid(): string {
  return Math.random().toString(36).slice(2);
}

function dayOffsetDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}
