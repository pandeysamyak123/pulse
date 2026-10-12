// Hot List: twice-weekly email to Arjun — top 10 accounts by signals from the
// last 72h, each with a one-line summary + Gemini outreach angle, plus
// Follow-ups due and Gone quiet. Gmail-safe HTML (tables + inline styles).
import "server-only";
import { Resend } from "resend";
import { supabaseAdmin, must } from "./supabase";
import { readiness } from "./readiness";
import type { Account, Activity, Signal } from "./types";

const DAY = 86_400_000;
const TIER = {
  hot: { label: "HOT", color: "#E2401F", bg: "#FDEBE6" },
  warm: { label: "WARM", color: "#B7791F", bg: "#FBF1DE" },
  cool: { label: "COOL", color: "#0B87A6", bg: "#E0F3F8" },
  quiet: { label: "QUIET", color: "#5F6B80", bg: "#EEF0F4" },
} as const;
const WEIGHT: Record<string, number> = {
  leadership_hire: 30,
  headcount_expansion: 28,
  funding_round: 25,
  workforce_digitalisation: 22,
  operational_challenge: 20,
  expansion_geo: 18,
  m_and_a: 15,
};
const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Row = {
  a: Account;
  sig: Signal & { articles?: { url: string; source_name: string | null } | null };
  strength: number;
  count: number;
  daysSinceContact: number | null;
};

export async function buildHotList(now = new Date()) {
  const db = supabaseAdmin();
  const since72 = new Date(now.getTime() - 3 * DAY).toISOString();
  const [accounts, signals, activities] = await Promise.all([
    db.from("accounts").select("*"),
    db.from("signals").select("*, articles(url, source_name)").gte("published_at", since72).eq("is_cluster_lead", true),
    db.from("activities").select("*").order("occurred_at", { ascending: false }),
  ]);
  const accs = must(accounts, "accounts") as Account[];
  const sigs = must(signals, "signals") as Row["sig"][];
  const acts = must(activities, "activities") as Activity[];
  const today = now.toISOString().slice(0, 10);

  const rows: Row[] = accs
    .map((a) => {
      const mine = sigs.filter((s) => s.account_id === a.id);
      if (!mine.length) return null;
      const strength = mine.reduce((t, s) => t + (WEIGHT[s.signal_type] ?? 15) * Number(s.confidence), 0);
      const best = mine.sort((x, y) => (WEIGHT[y.signal_type] ?? 0) * Number(y.confidence) - (WEIGHT[x.signal_type] ?? 0) * Number(x.confidence))[0];
      return {
        a,
        sig: best,
        strength,
        count: mine.length,
        daysSinceContact: a.last_contact_date ? Math.floor((now.getTime() - Date.parse(a.last_contact_date)) / DAY) : null,
      };
    })
    .filter((r): r is Row => !!r)
    .sort((x, y) => y.strength - x.strength || Number(y.a.warmth_score) - Number(x.a.warmth_score))
    .slice(0, 10);

  const followUps = accs
    .map((a) => ({ a, r: readiness(a, acts.filter((x) => x.account_id === a.id)) }))
    .filter(({ a, r }) => r.state === "follow_up" || (!!a.next_step_due && a.next_step_due <= today && r.state !== "paused"))
    .map(({ a, r }) => ({ a, why: r.state === "follow_up" ? `No reply in ${r.days} days` : `${a.next_step ?? "Next step"} — due ${a.next_step_due}` }));

  const goneQuiet = accs.filter((a) => a.score_trend === "falling");
  const counts = {
    hot: accs.filter((a) => a.warmth_tier === "hot").length,
    warm: accs.filter((a) => a.warmth_tier === "warm").length,
    cool: accs.filter((a) => a.warmth_tier === "cool").length,
    followUps: followUps.length,
  };
  const fallback = rows.length
    ? []
    : accs
        .filter((a) => a.warmth_tier === "warm" || a.warmth_tier === "hot")
        .sort((x, y) => Number(y.warmth_score) - Number(x.warmth_score))
        .slice(0, 3);

  const dateLabel = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  const subject = rows.length
    ? `Hot List — ${dateLabel}: ${counts.hot} hot, ${counts.warm} warm, ${counts.followUps} follow-up${counts.followUps === 1 ? "" : "s"}`
    : `Hot List — ${dateLabel}: no hot accounts, ${fallback.length} warm to watch`;

  const html = renderHtml({ dateLabel, counts, rows, followUps, goneQuiet, fallback });
  return { subject, html, accountIds: rows.map((r) => r.a.id), counts };
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3400").replace(/\/$/, "");
}

function logo(a: Account) {
  return a.domain
    ? `<img src="https://www.google.com/s2/favicons?domain=${esc(a.domain)}&sz=64" width="28" height="28" alt="" style="display:block;border-radius:6px;border:1px solid #E6E7EC" />`
    : `<div style="width:28px;height:28px;border-radius:6px;background:#EEF0F4;color:#5F6B80;font:600 12px/28px Arial;text-align:center">${esc(a.company_name.slice(0, 2).toUpperCase())}</div>`;
}

function renderHtml(d: {
  dateLabel: string;
  counts: { hot: number; warm: number; cool: number; followUps: number };
  rows: Row[];
  followUps: { a: Account; why: string }[];
  goneQuiet: Account[];
  fallback: Account[];
}) {
  const url = appUrl();
  const pill = (t: keyof typeof TIER, n: number) =>
    `<td style="padding:0 6px 0 0"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${TIER[t].bg};color:${TIER[t].color};font:700 12px Arial">${n} ${TIER[t].label}</span></td>`;
  const card = (r: Row) => {
    const t = TIER[r.a.warmth_tier];
    return `
<tr><td style="padding:0 0 12px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E6E7EC;border-radius:12px;border-left:4px solid ${t.color}">
    <tr><td style="padding:14px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="36" valign="top">${logo(r.a)}</td>
        <td valign="top" style="font:600 15px Arial;color:#0F1117">${esc(r.a.company_name)}
          <span style="font:700 10px Arial;color:${t.color};letter-spacing:.06em;padding-left:6px">${t.label} · ${Number(r.a.warmth_score).toFixed(0)}</span>
          <div style="font:12px Arial;color:#6B7183;padding-top:2px">${esc(r.a.stage)} · ${r.daysSinceContact == null ? "never contacted" : `last contact ${r.daysSinceContact}d ago`}${r.count > 1 ? ` · ${r.count} signals in 72h` : ""}</div>
        </td>
      </tr></table>
      <div style="padding-top:10px"><span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#F1EEFF;color:#5B3DE0;font:600 12px Arial">⚡ ${esc(r.sig.chip ?? r.sig.signal_type)}</span></div>
      <div style="font:14px/1.45 Arial;color:#0F1117;padding-top:8px">${esc(r.a.signal_summary ?? r.sig.summary)}</div>
      ${r.a.outreach_angle ? `<div style="font:13px/1.45 Arial;color:#565C6B;padding-top:4px"><b style="color:#0F1117">Angle:</b> ${esc(r.a.outreach_angle)}</div>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" style="padding-top:12px"><tr>
        <td><a href="${url}/accounts/${r.a.id}?tab=outreach" style="display:inline-block;background:#6A4BF0;color:#FFFFFF;text-decoration:none;font:600 13px Arial;padding:8px 14px;border-radius:8px">Open in Pulse →</a></td>
        ${r.sig.articles?.url ? `<td style="padding-left:12px"><a href="${esc(r.sig.articles.url)}" style="font:12px Arial;color:#6B7183">${esc(r.sig.articles.source_name ?? "Source")} ↗</a></td>` : ""}
      </tr></table>
    </td></tr>
  </table>
</td></tr>`;
  };
  const listSection = (title: string, items: string[]) =>
    items.length
      ? `<tr><td style="padding:12px 0 6px 0;font:700 12px Arial;letter-spacing:.06em;color:#6B7183;text-transform:uppercase">${title}</td></tr>
         <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E6E7EC;border-radius:12px">${items.join("")}</table></td></tr>`
      : "";
  const li = (a: Account, right: string) =>
    `<tr><td style="padding:10px 16px;border-bottom:1px solid #F0F1F4;font:14px Arial"><a href="${url}/accounts/${a.id}" style="color:#0F1117;text-decoration:none;font-weight:600">${esc(a.company_name)}</a> <span style="color:#6B7183;font-size:13px">— ${esc(right)}</span></td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"><title>Pulse Hot List</title></head>
<body style="margin:0;padding:0;background:#F6F6F9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 0 16px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0B0F;border-radius:14px"><tr><td style="padding:20px 22px">
      <div style="font:700 13px Arial;color:#B5A3FF;letter-spacing:.08em">PULSE · HOT LIST</div>
      <div style="font:700 22px Arial;color:#FFFFFF;padding-top:4px">${esc(d.dateLabel)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="padding-top:12px"><tr>${pill("hot", d.counts.hot)}${pill("warm", d.counts.warm)}${pill("cool", d.counts.cool)}
        <td><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#1D212B;color:#9097A7;font:700 12px Arial">${d.counts.followUps} FOLLOW-UPS</span></td></tr></table>
    </td></tr></table>
  </td></tr>
  ${
    d.rows.length
      ? `<tr><td style="padding:0 0 8px 0;font:700 12px Arial;letter-spacing:.06em;color:#6B7183">TRIGGERED IN THE LAST 72 HOURS</td></tr>${d.rows.map(card).join("")}`
      : `<tr><td style="padding:0 0 12px 0;font:15px/1.5 Arial;color:#0F1117">No hot accounts — nothing new in the last 72 hours. ${d.fallback.length ? "Warm accounts worth a look:" : ""}</td></tr>${listSection("Warm to watch", d.fallback.map((a) => li(a, a.signal_summary ?? a.why_now ?? `${a.warmth_tier} · ${Number(a.warmth_score).toFixed(0)}`)))}`
  }
  ${listSection("Follow-ups due", d.followUps.map((f) => li(f.a, f.why)))}
  ${listSection("Gone quiet", d.goneQuiet.map((a) => li(a, `score falling · now ${Number(a.warmth_score).toFixed(0)}`)))}
  <tr><td style="padding:18px 0 0 0;font:12px/1.5 Arial;color:#9097A7;text-align:center">Pulse · sent Mon &amp; Thu 08:00 IST · <a href="${url}" style="color:#6A4BF0">Open dashboard</a><br/>Your notes and history are never changed by automation.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendHotList(kind: "hotlist" | "preview") {
  const built = await buildHotList();
  const to = process.env.HOTLIST_TO_EMAIL;
  const db = supabaseAdmin();
  if (!to) throw new Error("HOTLIST_TO_EMAIL is not set");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.OUTREACH_FROM_EMAIL || "Pulse <onboarding@resend.dev>",
    to: [to],
    subject: kind === "preview" ? `[Preview] ${built.subject}` : built.subject,
    html: built.html,
  });
  must(
    await db.from("email_runs").insert({
      kind,
      recipient: to,
      subject: built.subject,
      account_ids: built.accountIds,
      html: built.html,
      status: error ? "failed" : "sent",
      provider_id: data?.id ?? null,
      error: error?.message ?? null,
    }),
    "email_runs",
  );
  if (error) throw new Error(`Resend: ${error.message}`);
  return { ...built, id: data?.id };
}
