"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Mail, MailPlus, Pause, RefreshCw, Reply, Send, ShieldCheck, Sparkles, Star, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { logActivity, regenerate } from "@/app/actions";
import { ago, cn, SIGNAL_LABEL } from "@/lib/format";
import { readinessLabel } from "@/lib/readiness";
import type { Contact, Draft } from "@/lib/types";
import { Button, EmptyState, Linkedin, OwnerTag, SignalIcon, Tip } from "../ui";
import type { WorkspaceProps } from "./workspace";

type Channel = Draft["channel"];
const CHANNELS: { id: Channel; label: string; icon: React.ComponentType<{ className?: string }>; limit: { n: number; unit: "words" | "chars" } }[] = [
  { id: "email", label: "Email", icon: Mail, limit: { n: 120, unit: "words" } },
  { id: "linkedin_connect", label: "Connect note", icon: Linkedin, limit: { n: 280, unit: "chars" } },
  { id: "linkedin_dm", label: "LinkedIn DM", icon: Linkedin, limit: { n: 600, unit: "chars" } },
  { id: "linkedin_followup", label: "Follow-up", icon: Reply, limit: { n: 90, unit: "words" } },
];
const TONES = ["crisp", "warm", "executive"] as const;

export function Outreach(p: WorkspaceProps) {
  const router = useRouter();
  const a = p.account;
  const drafts = useMemo(() => new Map(p.drafts.map((d) => [d.channel, d])), [p.drafts]);
  const firstAvailable = CHANNELS.find((c) => drafts.has(c.id))?.id ?? "email";
  const [channel, setChannel] = useState<Channel>(p.readiness.state === "follow_up" && drafts.has("linkedin_followup") ? "linkedin_followup" : firstAvailable);
  const draft = drafts.get(channel);
  const defaultContact = draft?.contact_id ?? a.recommended_contact_id ?? p.contacts.find((c) => c.is_primary)?.id ?? p.contacts[0]?.id ?? null;
  const [contactId, setContactId] = useState<string | null>(defaultContact);
  const contact = p.contacts.find((c) => c.id === contactId) ?? null;
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [tone, setTone] = useState<(typeof TONES)[number]>((draft?.tone as (typeof TONES)[number]) ?? "crisp");
  const [regen, setRegen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setSubject(draft?.subject ?? "");
    setBody(draft?.body ?? "");
  }, [draft?.id, draft?.subject, draft?.body]);

  const sig = p.signals.find((s) => s.id === draft?.based_on_signal_id);
  const meta = CHANNELS.find((c) => c.id === channel)!;
  const count = meta.limit.unit === "words" ? body.trim().split(/\s+/).filter(Boolean).length : body.length;
  const over = count > meta.limit.n;
  const isEmailish = channel === "email" || channel === "linkedin_followup";

  const doRegen = async () => {
    if (!p.authed) return toast("Read-only demo", { description: "Unlock to regenerate drafts." });
    setRegen(true);
    const t = toast.loading(`Regenerating · ${tone}…`);
    const r = await regenerate(a.id, tone);
    setRegen(false);
    if (r.ok) {
      toast.success("Fresh drafts ready", { id: t, description: r.data?.flags?.length ? `Checks: ${r.data.flags[0]}` : "All quality checks passed" });
      router.refresh();
    } else toast.error("Couldn't regenerate", { id: t, description: r.error });
  };

  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Copied to clipboard", { description: contact?.linkedin_url ? "Opening LinkedIn — paste and send, then mark as sent." : "No LinkedIn URL on this contact." });
    } catch {
      toast.error("Clipboard blocked — select the text and copy manually.");
    }
    if (contact?.linkedin_url) window.open(contact.linkedin_url, "_blank", "noopener,noreferrer");
  };

  const markSent = async () => {
    if (!p.authed) return toast("Read-only demo", { description: "Unlock to log activity." });
    const r = await logActivity({
      account_id: a.id,
      contact_id: contactId,
      channel: "linkedin",
      direction: "outbound",
      subject: meta.label,
      body_sent: body,
      outcome: "no_reply",
      created_via: "linkedin_mark_sent",
      draft_id: draft?.id ?? null,
    });
    if (r.ok) {
      toast.success("Logged LinkedIn message", { description: "Last-contact date updated. Use “Reply received?” in History when they answer." });
      router.refresh();
    } else toast.error(r.error);
  };

  const gmailUrl = contact?.email
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  if (!p.drafts.length) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title={a.signals_last_14d ? "No drafts yet for this trigger." : "No fresh trigger in 14 days — drafts appear when something happens. You can still generate a nurture draft."}
        action={
          <Button variant="primary" onClick={doRegen} disabled={regen || !p.authed}>
            {regen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate drafts
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      {/* Left: channel + contact */}
      <aside className="space-y-4">
        {p.readiness.state !== "ready" && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3 text-sm",
              p.readiness.state === "paused" ? "border-line-strong bg-surface-2 text-muted" : "border-[color-mix(in_oklab,var(--warm)_40%,transparent)] bg-[color-mix(in_oklab,var(--warm)_8%,transparent)]",
            )}
          >
            {p.readiness.state === "paused" ? <Pause className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warm" />}
            <span>{readinessLabel(p.readiness)}</span>
          </div>
        )}
        <div className="card p-2" role="tablist" aria-label="Channel">
          {CHANNELS.map((c) => {
            const has = drafts.has(c.id);
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={channel === c.id}
                disabled={!has}
                onClick={() => setChannel(c.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  channel === c.id ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2",
                )}
              >
                <c.icon className="h-4 w-4" />
                <span className="flex-1">{c.label}</span>
                {!has && <span className="text-[10px] text-faint">n/a</span>}
                {has && (drafts.get(c.id)!.quality_flags?.length ?? 0) > 0 && (
                  <Tip label="Has quality warnings">
                    <AlertTriangle className="h-3.5 w-3.5 text-warm" />
                  </Tip>
                )}
              </button>
            );
          })}
        </div>
        <div className="card p-3">
          <span className="label mb-2 block px-1">Send to</span>
          <ul className="space-y-1">
            {p.contacts.map((c) => (
              <ContactOption key={c.id} c={c} selected={contactId === c.id} recommended={a.recommended_contact_id === c.id} onSelect={() => setContactId(c.id)} />
            ))}
          </ul>
          {a.recommended_contact_reason && <p className="mt-2 px-1 text-xs text-faint">★ {a.recommended_contact_reason}</p>}
        </div>
      </aside>

      {/* Right: editor */}
      <section className="card flex flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {sig ? (
            <Tip label={sig.summary}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent-text">
                <SignalIcon type={sig.signal_type} /> Based on: {sig.chip || SIGNAL_LABEL[sig.signal_type]} · <span className="num">{ago(sig.published_at)}</span>
              </span>
            </Tip>
          ) : (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">Nurture draft</span>
          )}
          <OwnerTag owner="pulse" />
          <span className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Tone">
            {TONES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={tone === t}
                onClick={() => setTone(t)}
                className={cn("rounded-lg px-2.5 py-1 text-xs capitalize", tone === t ? "bg-surface-3 text-text shadow-sm" : "text-muted hover:text-text")}
              >
                {t}
              </button>
            ))}
          </span>
          <Tip label={p.authed ? `Regenerate all drafts in a ${tone} tone (uses Gemini)` : "Unlock to regenerate"}>
            <Button size="sm" onClick={doRegen} disabled={regen || !p.authed} aria-label="Regenerate">
              {regen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </Tip>
        </div>

        {(draft?.quality_flags?.length ?? 0) > 0 && (
          <div className="mb-3 rounded-xl border border-[color-mix(in_oklab,var(--warm)_40%,transparent)] bg-[color-mix(in_oklab,var(--warm)_8%,transparent)] px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-warm">
              <AlertTriangle className="h-3.5 w-3.5" /> Quality check — review before sending
            </span>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
              {draft!.quality_flags.slice(0, 4).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {isEmailish && (
          <input
            aria-label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="mb-2 h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium outline-none focus:border-accent"
          />
        )}
        <textarea
          aria-label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === "linkedin_connect" ? 5 : 12}
          className="min-h-40 flex-1 resize-y rounded-xl border border-line bg-surface-2 p-3 text-[15px] leading-relaxed outline-none focus:border-accent"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-faint">{contact ? `To ${contact.full_name}${isEmailish && contact.email ? ` · ${contact.email}` : ""}` : "Pick a contact"}</span>
          <span className={cn("num", over ? "font-semibold text-bad" : count > meta.limit.n * 0.9 ? "text-warm" : "text-faint")}>
            {count} / {meta.limit.n} {meta.limit.unit}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {isEmailish && (
            <>
              <Tip label={!p.authed ? "Unlock to send" : !contact?.email ? "Contact has no email" : "Review, then send via Resend"}>
                <Button variant="primary" onClick={() => setConfirm(true)} disabled={!p.authed || !contact?.email || !subject.trim() || !body.trim()}>
                  <Send className="h-4 w-4" /> Send email
                </Button>
              </Tip>
              {gmailUrl && (
                <a href={gmailUrl} target="_blank" rel="noreferrer">
                  <Button>
                    <MailPlus className="h-4 w-4" /> Open in Gmail
                  </Button>
                </a>
              )}
            </>
          )}
          {channel !== "email" && (
            <>
              <Button variant={isEmailish ? "outline" : "primary"} onClick={copyAndOpen}>
                <Copy className="h-4 w-4" /> Copy & open LinkedIn
              </Button>
              <Tip label={p.authed ? "Log it after you send on LinkedIn" : "Unlock to log"}>
                <Button onClick={markSent} disabled={!p.authed}>
                  <Check className="h-4 w-4" /> Mark as sent on LinkedIn
                </Button>
              </Tip>
            </>
          )}
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-faint sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-ok" /> Nothing is ever sent automatically
          </span>
        </div>
      </section>

      <ConfirmSend
        open={confirm}
        onClose={() => setConfirm(false)}
        to={contact}
        subject={subject}
        body={body}
        safeMode={p.safeMode}
        demoInbox={p.demoInbox}
        onSend={async () => {
          const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account_id: a.id, contact_id: contactId, to: contact?.email, subject, body, draft_id: draft?.id }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error ?? "Send failed");
          toast.success(j.safe ? `Sent (SAFE MODE) → ${j.deliveredTo}` : `Sent to ${j.deliveredTo}`, { description: "Logged in History · last contact updated" });
          setConfirm(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function ContactOption({ c, selected, recommended, onSelect }: { c: Contact; selected: boolean; recommended: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
          selected ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-surface-2",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-muted">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-sm font-medium">
            {c.full_name}
            {recommended && (
              <Tip label="Recommended by Pulse for this trigger">
                <Star className="h-3 w-3 fill-warm text-warm" />
              </Tip>
            )}
          </span>
          <span className="block truncate text-xs text-faint">{c.title}</span>
        </span>
        <span className="flex gap-1 text-faint">
          {c.email && <Mail className="h-3.5 w-3.5" aria-label="has email" />}
          {c.linkedin_url && <Linkedin className="h-3.5 w-3.5" aria-label="has LinkedIn" />}
        </span>
      </button>
    </li>
  );
}

function ConfirmSend({
  open,
  onClose,
  to,
  subject,
  body,
  safeMode,
  demoInbox,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  to: Contact | null;
  subject: string;
  body: string;
  safeMode: boolean;
  demoInbox: string;
  onSend: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm send"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <Send className="h-4 w-4 text-accent-text" /> Send this email?
              </span>
              <button onClick={onClose} aria-label="Close" className="text-faint hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-faint">To</dt>
                <dd>
                  {to?.full_name} · {to?.email}
                </dd>
              </div>
              {safeMode && (
                <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-ok" /> SAFE MODE: delivered to <b className="text-text">{demoInbox || "demo inbox"}</b> instead.
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-faint">Subject</dt>
                <dd className="font-medium">{subject}</dd>
              </div>
            </dl>
            <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-2 p-3 font-sans text-sm leading-relaxed">{body}</pre>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSend();
                  } catch (e) {
                    toast.error("Not sent", { description: (e as Error).message });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send now
              </Button>
            </div>
            <a className="mt-3 flex items-center gap-1 text-[11px] text-faint" href="https://resend.com" target="_blank" rel="noreferrer">
              Sent via Resend · reply-to goes to Arjun <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
