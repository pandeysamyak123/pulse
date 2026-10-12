"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, CalendarDays, ChevronDown, Loader2, Mail, MessageCircle, MoreHorizontal, Phone, Pin, PinOff, Plus, StickyNote, Users2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addNote, logActivity, setActivityOutcome, setNotePinned } from "@/app/actions";
import { cn, fmtDate, fmtDateTime } from "@/lib/format";
import type { Activity, Note } from "@/lib/types";
import { Button, Kbd, Linkedin, OwnerTag, Tip } from "../ui";
import type { WorkspaceProps } from "./workspace";

const CH = {
  email: { icon: Mail, label: "Email" },
  linkedin: { icon: Linkedin, label: "LinkedIn" },
  call: { icon: Phone, label: "Call" },
  meeting: { icon: Users2, label: "Meeting" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  other: { icon: MoreHorizontal, label: "Other" },
} as const;

const OUTCOME = {
  no_reply: { label: "No reply", color: "var(--faint)" },
  replied: { label: "Replied", color: "var(--ok)" },
  meeting_booked: { label: "Meeting booked", color: "var(--accent)" },
  not_interested: { label: "Not interested", color: "var(--bad)" },
  follow_up: { label: "Follow up", color: "var(--warm)" },
} as const;

type Item = { kind: "activity"; at: string; a: Activity } | { kind: "note"; at: string; n: Note };

export function HistoryTab(p: WorkspaceProps) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setOptimistic([]), [p.activities, p.notes]);

  const items: Item[] = [
    ...optimistic,
    ...p.activities.map((a) => ({ kind: "activity" as const, at: a.occurred_at, a })),
    ...p.notes.map((n) => ({ kind: "note" as const, at: n.created_at, n })),
  ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  const shown = expanded ? items : items.slice(0, 5);
  const contactName = (id: string | null) => p.contacts.find((c) => c.id === id)?.full_name;
  const pinned = p.notes.filter((n) => n.pinned);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <LogRow p={p} onOptimistic={(it) => setOptimistic((o) => [it, ...o])} onDone={() => router.refresh()} />
        <NoteBox p={p} onOptimistic={(it) => setOptimistic((o) => [it, ...o])} onDone={() => router.refresh()} />

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <OwnerTag owner="you" />
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted">No reach-outs or notes yet.</p>
          ) : (
            <ol className="relative">
              <span className="absolute bottom-2 left-[15px] top-2 w-px bg-line-strong" aria-hidden />
              <AnimatePresence initial={false}>
                {shown.map((it) => (
                  <motion.li
                    key={it.kind === "activity" ? `a${it.a.id}` : `n${it.n.id}`}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {it.kind === "activity" ? (
                      <ActivityItem a={it.a} who={contactName(it.a.contact_id)} accountId={p.account.id} authed={p.authed} onChanged={() => router.refresh()} />
                    ) : (
                      <NoteItem n={it.n} accountId={p.account.id} authed={p.authed} onChanged={() => router.refresh()} />
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
          {items.length > 5 && (
            <button onClick={() => setExpanded((e) => !e)} className="mt-3 flex items-center gap-1 text-xs text-accent-text hover:underline">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
        </section>
      </div>

      <aside className="space-y-5">
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Pin className="h-3.5 w-3.5" /> Pinned
            </h2>
            <OwnerTag owner="you" />
          </div>
          <p className="text-sm">{p.account.arjun_notes ?? <span className="text-faint">No headline note.</span>}</p>
          {pinned.map((n) => (
            <p key={n.id} className="mt-2 border-t border-line pt-2 text-sm text-muted">
              {n.body}
            </p>
          ))}
        </section>

        <section className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Bot className="h-4 w-4 text-accent-text" /> AI digest
            </h2>
            <OwnerTag owner="pulse" />
          </div>
          {p.digest ? (
            <>
              <p className="text-sm text-muted">{p.digest.digest}</p>
              {p.digest.open_loops.length > 0 && (
                <>
                  <span className="label mb-1.5 mt-4 block">Open loops</span>
                  <ul className="space-y-1.5">
                    {p.digest.open_loops.map((l, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full border border-warm" />
                        {l}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {p.digest.suggested_next_step && (
                <div className="mt-4 rounded-xl bg-accent-soft px-3 py-2 text-sm">
                  <span className="label mb-0.5 block text-accent-text">Suggested next step</span>
                  {p.digest.suggested_next_step}
                </div>
              )}
              <p className="mt-3 text-[11px] text-faint">Summarised from your notes · stored separately, never written into them · {fmtDateTime(p.digest.generated_at)}</p>
            </>
          ) : (
            <p className="text-sm text-muted">The digest appears after the next scan.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

/* ───────── Timeline items ───────── */
function ActivityItem({ a, who, accountId, authed, onChanged }: { a: Activity; who?: string; accountId: string; authed: boolean; onChanged: () => void }) {
  const I = CH[a.channel].icon;
  const o = a.outcome ? OUTCOME[a.outcome] : null;
  const [open, setOpen] = useState(false);
  const awaiting = a.direction === "outbound" && (a.outcome === "no_reply" || a.outcome == null) && a.channel !== "meeting";
  const set = async (outcome: string) => {
    const r = await setActivityOutcome(accountId, a.id, outcome);
    if (r.ok) {
      toast.success(`Marked ${OUTCOME[outcome as keyof typeof OUTCOME].label.toLowerCase()}`);
      onChanged();
    } else toast.error(r.error);
  };
  return (
    <>
      <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2">
        <I className="h-3.5 w-3.5 text-muted" />
        {o && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]" style={{ background: o.color }} />}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">
            {a.direction === "inbound" ? "← " : ""}
            {CH[a.channel].label}
            {who && <span className="font-normal text-muted"> · {who}</span>}
          </span>
          {o && (
            <span className="rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ color: o.color, background: `color-mix(in oklab, ${o.color} 14%, transparent)` }}>
              {o.label}
            </span>
          )}
          {a.created_via !== "manual" && <span className="text-[10px] text-faint">{a.created_via === "send_button" ? "sent from Pulse" : "marked sent"}</span>}
          <span className="num ml-auto text-xs text-faint">{fmtDate(a.occurred_at)}</span>
        </div>
        {a.subject && <p className="truncate text-sm text-muted">{a.subject}</p>}
        {a.note && <p className="text-sm text-muted">{a.note}</p>}
        {a.body_sent && (
          <button onClick={() => setOpen((x) => !x)} className="mt-0.5 text-xs text-accent-text hover:underline">
            {open ? "Hide message" : "View message"}
          </button>
        )}
        {open && a.body_sent && <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-surface-2 p-2.5 font-sans text-xs text-muted">{a.body_sent}</pre>}
        {awaiting && authed && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
            <span className="text-faint">Reply received?</span>
            {(["replied", "meeting_booked", "not_interested"] as const).map((k) => (
              <button key={k} onClick={() => set(k)} className="rounded-full border border-line px-2 py-0.5 text-muted hover:border-line-strong hover:text-text">
                {OUTCOME[k].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NoteItem({ n, accountId, authed, onChanged }: { n: Note; accountId: string; authed: boolean; onChanged: () => void }) {
  return (
    <>
      <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-3">
        <StickyNote className="h-3.5 w-3.5 text-warm" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2">
        <div className="mb-0.5 flex items-center gap-2 text-[11px] text-faint">
          Note {n.pinned && <Pin className="h-3 w-3 text-warm" />}
          <span className="num ml-auto">{fmtDateTime(n.created_at)}</span>
          {authed && !n.id.startsWith("tmp") && (
            <Tip label={n.pinned ? "Unpin" : "Pin"}>
              <button
                aria-label={n.pinned ? "Unpin note" : "Pin note"}
                onClick={async () => {
                  const r = await setNotePinned(accountId, n.id, !n.pinned);
                  if (r.ok) onChanged();
                  else toast.error(r.error);
                }}
                className="hover:text-text"
              >
                {n.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </button>
            </Tip>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm">{n.body}</p>
      </div>
    </>
  );
}

/* ───────── Log activity: one inline row ───────── */
function LogRow({ p, onOptimistic, onDone }: { p: WorkspaceProps; onOptimistic: (i: Item) => void; onDone: () => void }) {
  const initial = (p.initialLog && p.initialLog in CH ? p.initialLog : "call") as keyof typeof CH;
  const [channel, setChannel] = useState<keyof typeof CH>(initial);
  const [outcome, setOutcome] = useState<keyof typeof OUTCOME | "">("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [contact, setContact] = useState<string>(p.account.recommended_contact_id ?? p.contacts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.initialLog) document.getElementById("log-activity")?.focus();
  }, [p.initialLog]);

  const submit = async () => {
    if (!p.authed) return toast("Read-only demo", { description: "Unlock to log activity." });
    setBusy(true);
    const occurred = date === new Date().toISOString().slice(0, 10) ? new Date().toISOString() : new Date(`${date}T12:00:00+05:30`).toISOString();
    const tmp: Activity = {
      id: `tmp${Date.now()}`,
      account_id: p.account.id,
      contact_id: contact || null,
      channel,
      direction: "outbound",
      subject: null,
      body_sent: null,
      outcome: (outcome || null) as Activity["outcome"],
      note: note || null,
      occurred_at: occurred,
      created_via: "manual",
      draft_id: null,
    };
    onOptimistic({ kind: "activity", at: occurred, a: tmp });
    const r = await logActivity({
      account_id: p.account.id,
      contact_id: contact || null,
      channel,
      direction: "outbound",
      outcome: outcome || null,
      note: note || null,
      occurred_at: occurred,
    });
    setBusy(false);
    if (r.ok) {
      toast.success(`${CH[channel].label} logged`);
      setNote("");
      setOutcome("");
      onDone();
    } else toast.error(r.error);
  };

  return (
    <div ref={ref} className="card flex flex-wrap items-center gap-2 p-3">
      <span className="label mr-1 hidden sm:block">Log</span>
      <div className="flex gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Channel">
        {(Object.keys(CH) as (keyof typeof CH)[]).map((k, i) => {
          const I = CH[k].icon;
          return (
            <Tip key={k} label={CH[k].label} side="bottom">
              <button
                id={i === 0 ? "log-activity" : undefined}
                role="radio"
                aria-checked={channel === k}
                aria-label={CH[k].label}
                onClick={() => setChannel(k)}
                className={cn("grid h-8 w-8 place-items-center rounded-lg", channel === k ? "bg-accent text-white" : "text-muted hover:text-text")}
              >
                <I className="h-3.5 w-3.5" />
              </button>
            </Tip>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Outcome">
        {(Object.keys(OUTCOME) as (keyof typeof OUTCOME)[]).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={outcome === k}
            onClick={() => setOutcome(outcome === k ? "" : k)}
            className={cn(
              "h-7 rounded-full border px-2.5 text-xs transition-colors",
              outcome === k ? "border-transparent text-white" : "border-line text-muted hover:text-text",
            )}
            style={outcome === k ? { background: OUTCOME[k].color } : undefined}
          >
            {OUTCOME[k].label}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Optional note…"
        aria-label="Activity note"
        className="h-9 min-w-40 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
      />
      <select value={contact} onChange={(e) => setContact(e.target.value)} aria-label="Contact" className="h-9 max-w-36 rounded-xl border border-line bg-surface-2 px-2 text-xs text-muted outline-none">
        <option value="">No contact</option>
        {p.contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>
      <label className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2 text-xs text-muted">
        <CalendarDays className="h-3.5 w-3.5" />
        <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="bg-transparent outline-none" />
      </label>
      <Button variant="primary" size="sm" onClick={submit} disabled={busy || !p.authed} className="h-9">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Log
      </Button>
    </div>
  );
}

/* ───────── Add note ───────── */
function NoteBox({ p, onOptimistic, onDone }: { p: WorkspaceProps; onOptimistic: (i: Item) => void; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [pin, setPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!body.trim()) return;
    if (!p.authed) return toast("Read-only demo", { description: "Unlock to add notes." });
    setBusy(true);
    const now = new Date().toISOString();
    onOptimistic({ kind: "note", at: now, n: { id: `tmp${Date.now()}`, account_id: p.account.id, body, pinned: pin, created_at: now } });
    const r = await addNote(p.account.id, body, pin);
    setBusy(false);
    if (r.ok) {
      setBody("");
      setPin(false);
      toast.success("Note saved");
      onDone();
    } else toast.error(r.error);
  };
  return (
    <div className="card flex items-start gap-2 p-3">
      <StickyNote className="mt-2.5 h-4 w-4 shrink-0 text-warm" />
      <textarea
        id="add-note"
        rows={1}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
        placeholder="Add a note…  (⌘↵ to save)"
        aria-label="Add a note"
        className="min-h-9 flex-1 resize-y rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <Tip label={pin ? "Will be pinned" : "Pin this note"}>
        <Button size="sm" variant={pin ? "primary" : "ghost"} onClick={() => setPin((x) => !x)} aria-label="Toggle pin" className="h-9">
          <Pin className="h-3.5 w-3.5" />
        </Button>
      </Tip>
      <Button size="sm" onClick={submit} disabled={busy || !body.trim() || !p.authed} className="h-9">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
      </Button>
      <span className="hidden self-center sm:block">
        <Kbd>N</Kbd>
      </span>
    </div>
  );
}
