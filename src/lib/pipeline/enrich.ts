// Steps 6–7 — Brief, outreach angle, drafts and note digest (Gemini Flash).
//
// Arjun's notes, notes log and activities are read as READ-ONLY context so
// drafts never repeat what he already said. Outputs go to SYSTEM places only:
// accounts SYSTEM columns (via apply_signal_update), outreach_drafts, note_digests.
import { createHash } from "crypto";
import { z } from "zod";
import { generateJson, type GeminiUsage } from "../gemini";
import { supabaseAdmin, must } from "../supabase";
import { checkDrafts, enforceLimits, triggerTerms, LIMITS, type DraftSet } from "./draft-checks";
import type { EnrichContext } from "./scan";
import type { AccountRow } from "./types";
import type { SignalRow } from "./score";

const DAY = 86_400_000;
export type Tone = "crisp" | "warm" | "executive";
const TONE_GUIDE: Record<Tone, string> = {
  crisp: "Crisp: short sentences, direct, zero fluff.",
  warm: "Warm: friendly and human, still brief; one personal touch grounded in the facts given.",
  executive: "Executive: board-level framing (cost, risk, scale), very concise, no product jargon.",
};

type Contact = { id: string; full_name: string; title: string | null; is_primary: boolean; notes: string | null };
type Activity = {
  channel: string;
  direction: string;
  subject: string | null;
  body_sent: string | null;
  outcome: string | null;
  note: string | null;
  occurred_at: string;
  contact_id: string | null;
};
type Note = { body: string; created_at: string; pinned: boolean };
type Profile = { product_name: string; description: string; buyers: string; best_fit: string; sender_name: string; signature: string };
type Article = { title: string; ai_one_liner: string | null; published_at: string | null; is_trigger: boolean };

// ───────────── context (read-only) ─────────────
async function loadContext(accountId: string) {
  const db = supabaseAdmin();
  const [contacts, activities, notes, profile, articles] = await Promise.all([
    db.from("contacts").select("id, full_name, title, is_primary, notes").eq("account_id", accountId),
    db.from("activities").select("channel, direction, subject, body_sent, outcome, note, occurred_at, contact_id").eq("account_id", accountId).order("occurred_at", { ascending: false }),
    db.from("notes").select("body, created_at, pinned").eq("account_id", accountId).order("created_at", { ascending: false }),
    db.from("product_profile").select("*").eq("id", 1).single(),
    db.from("articles").select("title, ai_one_liner, published_at, is_trigger").eq("account_id", accountId).eq("is_about_company", true).order("published_at", { ascending: false }).limit(10),
  ]);
  return {
    contacts: must(contacts, "contacts") as Contact[],
    activities: must(activities, "activities") as Activity[],
    notes: must(notes, "notes") as Note[],
    profile: must(profile, "profile") as Profile,
    articles: must(articles, "articles") as Article[],
  };
}

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "?");
const daysSince = (d: string | null) => (d ? Math.floor((Date.now() - Date.parse(d)) / DAY) : null);

/** Deterministic readiness, shown next to warmth (never changes the score). */
export function readiness(a: Pick<AccountRow, "last_contact_date" | "do_not_contact_until">, activities: Activity[]) {
  const today = new Date().toISOString().slice(0, 10);
  if (a.do_not_contact_until && a.do_not_contact_until > today) return { state: "paused" as const, until: a.do_not_contact_until };
  const since = daysSince(a.last_contact_date);
  const lastOut = activities.find((x) => x.direction === "outbound");
  const unanswered = !!lastOut && (lastOut.outcome === "no_reply" || lastOut.outcome == null) && lastOut.channel !== "meeting";
  if (since != null && since < 7) return { state: "wait" as const, days: since, unanswered };
  if (unanswered && lastOut && daysSince(lastOut.occurred_at)! >= 5) return { state: "follow_up" as const, days: daysSince(lastOut.occurred_at)! };
  return { state: "ready" as const };
}

// ───────────── schemas ─────────────
const OutreachSchema = z.object({
  company_brief: z.array(z.string()).min(1).max(3),
  signal_summary: z.string(),
  why_now: z.string(),
  outreach_angle: z.string(),
  recommended_contact_id: z.string(),
  recommended_contact_reason: z.string(),
  email: z.object({ subject: z.string(), body: z.string() }),
  linkedin_connect: z.string(),
  linkedin_dm: z.string(),
  followup: z.string(),
});
type Outreach = z.infer<typeof OutreachSchema>;

const BriefSchema = z.object({
  company_brief: z.array(z.string()).min(1).max(3),
  signal_summary: z.string(),
  why_now: z.string(),
});

const DigestSchema = z.object({
  digest: z.string(),
  open_loops: z.array(z.string()).max(4),
  suggested_next_step: z.string(),
});

const SYSTEM = `You are Arjun Mehta's sales co-pilot. Arjun sells a workforce-management SaaS to Indian mid-market and enterprise companies.
Rules for everything you write:
- Use ONLY the facts provided (signals, articles, notes, activities). Never invent numbers, names, quotes, customers or results. No fake stats.
- Never claim ShiftSense results, customer names, case studies or "we have helped…" — none are provided. Describe capabilities only.
- Never assume a pending item is finished (a migration, a pause, a pilot, a proposal) unless the facts say so. If something is pending, say "once … settles" or refer to the agreed date.
- No compliments or congratulations ("impressive", "congratulations").
- Indian business English. Plain, specific, no hype, no flattery.
- Never use: "I hope this finds you well", "hope you're doing well", "touching base", "circling back", "synergy", "game-changer", "revolutionise", "cutting-edge", "world-class".
- UI text must be tiny: company_brief = exactly 3 bullets of ≤ 10 words each; signal_summary ≤ 12 words; why_now ≤ 2 short sentences (≤ 30 words total); outreach_angle 2–3 sentences (≤ 45 words); recommended_contact_reason ≤ 15 words.`;

function contextBlock(a: AccountRow, ctx: Awaited<ReturnType<typeof loadContext>>, signals: SignalRow[], ready: ReturnType<typeof readiness>) {
  const top = signals.filter((s) => s.is_cluster_lead).slice(0, 3);
  const contactName = (id: string | null) => ctx.contacts.find((c) => c.id === id)?.full_name ?? "—";
  return `COMPANY: ${a.company_name} (${a.industry ?? "?"}) · stage: ${a.stage}

TOP SIGNALS (best first):
${top.length ? top.map((s) => `- [${s.id}] ${s.signal_type} · ${s.chip} · ${fmtDate(s.published_at)} · ${s.summary} · evidence: "${s.evidence_snippet}"`).join("\n") : "- none in the last 14 days"}

LATEST ARTICLES:
${ctx.articles.map((x) => `- ${fmtDate(x.published_at)} ${x.ai_one_liner ?? x.title}`).join("\n") || "- none"}

CONTACTS (use these ids):
${ctx.contacts.map((c) => `- ${c.id} · ${c.full_name} · ${c.title ?? "?"}${c.is_primary ? " · primary" : ""}${c.notes ? ` · note: ${c.notes}` : ""}`).join("\n") || "- none"}

ARJUN'S CONTEXT (read-only — do not contradict, do not repeat what he already sent):
- Headline note: ${a.arjun_notes ?? "—"}
- Relationship read: ${a.relationship_read ?? "—"}
- Next step: ${a.next_step ?? "—"}
- Last contact: ${a.last_contact_date ?? "never"}${a.do_not_contact_until ? ` · DO NOT CONTACT UNTIL ${a.do_not_contact_until}` : ""}
- Notes log:
${ctx.notes.slice(0, 6).map((n) => `  · ${fmtDate(n.created_at)}${n.pinned ? " (pinned)" : ""}: ${n.body}`).join("\n") || "  · none"}
- Last 5 activities:
${ctx.activities.slice(0, 5).map((x) => `  · ${fmtDate(x.occurred_at)} ${x.direction} ${x.channel} to ${contactName(x.contact_id)} · outcome: ${x.outcome ?? "none"}${x.subject ? ` · subject: ${x.subject}` : ""}${x.body_sent ? ` · sent: "${x.body_sent.slice(0, 220)}"` : ""}${x.note ? ` · note: ${x.note}` : ""}`).join("\n") || "  · none"}

READINESS: ${JSON.stringify(ready)}`;
}

function outreachPrompt(base: string, profile: Profile, ready: ReturnType<typeof readiness>, tone: Tone, needFollowup: boolean, feedback?: string[]) {
  const mode =
    ready.state === "paused"
      ? `Arjun has PAUSED this account until ${ready.until}. why_now must say outreach waits until then. Drafts are prepared for when the pause ends: reference the latest trigger, acknowledge the earlier conversation, no pressure.`
      : ready.state === "wait"
        ? `Arjun contacted this account ${ready.days} day(s) ago. why_now must recommend waiting. Drafts must be a light follow-up on that conversation that adds the new trigger as value, NOT a cold opener.`
        : ready.state === "follow_up"
          ? `Arjun's last outbound message (${ready.days} days ago) got no reply. Write the followup draft: short, references his earlier message, adds the new trigger as a reason to reply. Email/LinkedIn drafts should also read as follow-ups, not cold openers.`
          : `No recent contact: drafts are first-touch messages.`;
  return `${base}

PRODUCT (${profile.product_name}): ${profile.description}
Buyers: ${profile.buyers}. Best fit: ${profile.best_fit}.
Signature (end the email with exactly this):
${profile.signature}

TONE: ${TONE_GUIDE[tone]}
MODE: ${mode}

Write:
- company_brief: 3 bullets on what is happening at the company lately.
- signal_summary, why_now, outreach_angle (connect the top trigger to ONE concrete product capability).
- recommended_contact_id: one id from CONTACTS (the best buyer for this trigger), or "" if none. recommended_contact_reason.
- email: subject ≤ ${LIMITS.subjectWords} words; body ≤ ${LIMITS.emailWords} words. Open with the specific trigger (name it concretely), connect it to one capability, end with ONE low-friction ask (e.g. a 20-minute call next week). Address the recommended contact by first name.
- linkedin_connect: ≤ ${LIMITS.linkedinConnectChars} characters INCLUDING spaces, references the trigger, no pitch, no signature.
- linkedin_dm: ≤ ${LIMITS.linkedinDmChars} characters, trigger → capability → one ask, sign "– Arjun".
- followup: ${needFollowup ? `≤ ${LIMITS.followupWords} words, a reply-chaser to Arjun's last unanswered message.` : `"" (empty string — not needed).`}
${feedback?.length ? `\nYOUR PREVIOUS DRAFT FAILED THESE CHECKS — fix every one:\n${feedback.map((f) => `- ${f}`).join("\n")}` : ""}`;
}

// ───────────── generators ─────────────
export async function generateOutreach(
  a: AccountRow,
  signals: SignalRow[],
  usage: GeminiUsage,
  opts: { tone?: Tone } = {},
): Promise<{ out: Outreach; flags: string[]; ready: ReturnType<typeof readiness>; ctx: Awaited<ReturnType<typeof loadContext>> } | null> {
  const tone = opts.tone ?? "crisp";
  const ctx = await loadContext(a.id);
  const ready = readiness(a, ctx.activities);
  const needFollowup = ready.state === "follow_up" || (ready.state === "wait" && !!ready.unanswered);
  const termSets = signals
    .filter((s) => s.is_cluster_lead)
    .slice(0, 3)
    .map((s) => triggerTerms(s.chip, s.summary));
  const base = contextBlock(a, ctx, signals, ready);
  const sourceFacts = `${base}\n${ctx.profile.description}\n${signals.map((s) => s.evidence_snippet ?? "").join("\n")}`;

  let feedback: string[] | undefined;
  let last: Outreach | null = null;
  let flags: string[] = [];
  for (let round = 0; round < 2; round++) {
    const out = await generateJson({
      schema: OutreachSchema,
      system: SYSTEM,
      prompt: outreachPrompt(base, ctx.profile, ready, tone, needFollowup, feedback),
      usage,
      temperature: 0.5,
      thinking: "LOW",
      label: `outreach ${a.company_name}`,
    });
    if (!out) return last ? { out: last, flags, ready, ctx } : null;
    if (!ctx.contacts.some((c) => c.id === out.recommended_contact_id)) out.recommended_contact_id = "";
    if (!needFollowup) out.followup = "";
    last = out;
    flags = checkDrafts(out as DraftSet, termSets, ready.state === "ready", sourceFacts);
    if (!flags.length) break;
    feedback = flags; // one regeneration with the failures fed back
  }
  const fixed = enforceLimits(last as DraftSet);
  return { out: { ...last!, ...fixed }, flags, ready, ctx };
}

async function saveDrafts(a: AccountRow, out: Outreach, flags: string[], signalId: string | null, tone: Tone, channels?: string[]) {
  const db = supabaseAdmin();
  const contact = out.recommended_contact_id || null;
  const rows = [
    { channel: "email", subject: out.email.subject, body: out.email.body },
    { channel: "linkedin_connect", subject: null, body: out.linkedin_connect },
    { channel: "linkedin_dm", subject: null, body: out.linkedin_dm },
    ...(out.followup ? [{ channel: "linkedin_followup", subject: out.email.subject ? `Re: ${out.email.subject}` : null, body: out.followup }] : []),
  ]
    .filter((r) => !channels || channels.includes(r.channel))
    .map((r) => ({ ...r, account_id: a.id, contact_id: contact, based_on_signal_id: signalId, tone, quality_flags: flags, status: "draft" }));
  if (!rows.length) return 0;

  // Older unused drafts for these channels are superseded (SYSTEM table — never Arjun's history).
  must(
    await db
      .from("outreach_drafts")
      .update({ status: "discarded" })
      .eq("account_id", a.id)
      .eq("status", "draft")
      .in("channel", rows.map((r) => r.channel)),
    "supersede drafts",
  );
  must(await db.from("outreach_drafts").insert(rows), "insert drafts");
  return rows.length;
}

/** Regenerate drafts for one account on demand (tone / channel choice from the UI). */
export async function regenerateDrafts(accountId: string, usage: GeminiUsage, opts: { tone?: Tone; channel?: string } = {}) {
  const db = supabaseAdmin();
  const a = must(await db.from("accounts").select("*").eq("id", accountId).single(), "account") as AccountRow;
  const signals = must(
    await db.from("signals").select("*").eq("account_id", accountId).eq("is_cluster_lead", true).order("published_at", { ascending: false }).limit(20),
    "signals",
  ) as SignalRow[];
  const breakdown = (a as unknown as { score_breakdown: { signal_id: string }[] }).score_breakdown ?? [];
  const order = new Map(breakdown.map((b, i) => [b.signal_id, i]));
  signals.sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99));
  const res = await generateOutreach(a, signals, usage, { tone: opts.tone });
  if (!res) throw new Error("Draft generation failed validation");
  const n = await saveDrafts(a, res.out, res.flags, signals[0]?.id ?? null, opts.tone ?? "crisp", opts.channel ? [opts.channel] : undefined);
  return { drafts: n, flags: res.flags };
}

// ───────────── note digest ─────────────
export async function digestNotes(a: AccountRow, usage: GeminiUsage, force = false) {
  const db = supabaseAdmin();
  const ctx = await loadContext(a.id);
  if (!ctx.notes.length && !ctx.activities.length) return false;
  const sourceHash = createHash("md5")
    .update(JSON.stringify([a.arjun_notes, a.relationship_read, a.next_step, ctx.notes, ctx.activities]))
    .digest("hex");
  const existing = (await db.from("note_digests").select("source_hash").eq("account_id", a.id).maybeSingle()).data as { source_hash: string } | null;
  if (!force && existing?.source_hash === sourceHash) return false; // unchanged since last digest

  const contactName = (id: string | null) => ctx.contacts.find((c) => c.id === id)?.full_name ?? "—";
  const prompt = `Summarise Arjun's own notes and reach-out history for ${a.company_name} (stage: ${a.stage}).
Use ONLY what is written below. Do not invent commitments.

Headline note: ${a.arjun_notes ?? "—"}
Relationship read: ${a.relationship_read ?? "—"}
Next step (his): ${a.next_step ?? "—"}${a.do_not_contact_until ? `\nPaused until: ${a.do_not_contact_until}` : ""}
Notes log:
${ctx.notes.map((n) => `- ${fmtDate(n.created_at)}: ${n.body}`).join("\n") || "- none"}
Activities:
${ctx.activities.map((x) => `- ${fmtDate(x.occurred_at)} ${x.direction} ${x.channel} with ${contactName(x.contact_id)} · outcome ${x.outcome ?? "none"}${x.note ? ` · ${x.note}` : ""}`).join("\n") || "- none"}

Return:
- digest: ≤ 40 words, where the relationship stands.
- open_loops: up to 4 short items (≤ 12 words each): promises Arjun made or questions pending. [] if none.
- suggested_next_step: ≤ 15 words, concrete.`;
  const out = await generateJson({ schema: DigestSchema, system: SYSTEM, prompt, usage, thinking: "LOW", label: `digest ${a.company_name}` });
  if (!out) return false;
  must(
    await db.from("note_digests").upsert({
      account_id: a.id,
      digest: out.digest,
      open_loops: out.open_loops.slice(0, 4),
      suggested_next_step: out.suggested_next_step,
      source_hash: sourceHash,
      generated_at: new Date().toISOString(),
    }),
    "note_digests upsert",
  );
  return true;
}

// ───────────── scan hook ─────────────
/**
 * Called by the scan after scoring. Spends Gemini calls only when something changed:
 *  - signal in last 14d and (new signals or no drafts for the current top signal) → full outreach call
 *  - otherwise, brief-only call if there are new articles or no brief yet
 *  - note digest only if Arjun's notes/activities changed since the last digest
 */
export async function enrichAccount(ctx: EnrichContext): Promise<{ drafts: number }> {
  const db = supabaseAdmin();
  const a = ctx.account;
  const leads = ctx.signals.filter((s) => s.is_cluster_lead);
  const breakdown = (a as unknown as { score_breakdown: { signal_id: string }[] }).score_breakdown ?? [];
  const order = new Map(breakdown.map((b, i) => [b.signal_id, i]));
  leads.sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99));
  const top = leads[0];
  const recent = top && Date.now() - Date.parse(top.published_at ?? top.detected_at) <= 14 * DAY;
  let drafts = 0;

  if (recent) {
    const have = must(
      await db.from("outreach_drafts").select("id").eq("account_id", a.id).eq("based_on_signal_id", top.id).limit(1),
      "drafts for signal",
    ) as { id: string }[];
    // Idempotent: one draft set per top signal unless new signals arrived.
    if (have.length === 0 || ctx.newSignals > 0) {
      const res = await generateOutreach(a, leads, ctx.usage);
      if (res) {
        must(
          await db.rpc("apply_signal_update", {
            p_account_id: a.id,
            p_payload: {
              company_brief: res.out.company_brief.slice(0, 3),
              signal_summary: res.out.signal_summary,
              why_now: res.out.why_now,
              outreach_angle: res.out.outreach_angle,
              recommended_contact_id: res.out.recommended_contact_id,
              recommended_contact_reason: res.out.recommended_contact_reason,
            },
          }),
          "apply brief",
        );
        drafts = await saveDrafts(a, res.out, res.flags, top.id, "crisp");
      }
    }
  } else {
    const hasBrief = !!(a as unknown as { company_brief: unknown }).company_brief;
    if (!hasBrief || ctx.newSignals > 0 || (await hasNewArticles(a.id))) {
      const c = await loadContext(a.id);
      const ready = readiness(a, c.activities);
      const out = await generateJson({
        schema: BriefSchema,
        system: SYSTEM,
        prompt: `${contextBlock(a, c, leads, ready)}

No fresh trigger in the last 14 days. Write company_brief (3 bullets on what is happening lately, from the articles), signal_summary (≤ 12 words; say "No fresh trigger" if nothing relevant) and why_now (≤ 2 short sentences: honest — e.g. stay patient, or nurture via the existing relationship).`,
        usage: ctx.usage,
        thinking: "LOW",
        label: `brief ${a.company_name}`,
      });
      if (out) {
        must(
          await db.rpc("apply_signal_update", {
            p_account_id: a.id,
            p_payload: { company_brief: out.company_brief.slice(0, 3), signal_summary: out.signal_summary, why_now: out.why_now, outreach_angle: null },
          }),
          "apply brief-only",
        );
      }
    }
  }

  await digestNotes(a, ctx.usage);
  return { drafts };
}

async function hasNewArticles(accountId: string) {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 20 * 60_000).toISOString(); // stored during this scan
  const { count } = await db.from("articles").select("id", { count: "exact", head: true }).eq("account_id", accountId).gte("created_at", since);
  return (count ?? 0) > 0;
}
