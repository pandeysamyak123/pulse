// Pure derivations shared by pages (no I/O).
import { readiness, type Readiness } from "./readiness";
import type { Account, Activity, Signal, Tier } from "./types";

const DAY = 86_400_000;

export const tierFor = (s: number): Tier => (s >= 60 ? "hot" : s >= 35 ? "warm" : s >= 15 ? "cool" : "quiet");

export type Chip = { id: string; type: string; chip: string | null; summary: string; at: string | null };

export type LatestNews = { text: string; title: string; at: string | null; url: string; source: string | null };

export type AccountView = Account & {
  latest: LatestNews[];
  readiness: Readiness;
  chips: Chip[];
  spark: number[];
  followUpDue: boolean;
  recommendedContact: string | null;
};

/** Top chips follow the score breakdown order (what actually drives the score), then recency. */
export function chipsFor(a: Account, signals: Signal[], n = 2): Chip[] {
  const mine = signals.filter((s) => s.account_id === a.id && s.is_cluster_lead);
  const order = new Map(a.score_breakdown?.map((b, i) => [b.signal_id, i]) ?? []);
  return mine
    .sort((x, y) => (order.get(x.id) ?? 99) - (order.get(y.id) ?? 99) || Date.parse(y.published_at ?? "") - Date.parse(x.published_at ?? ""))
    .slice(0, n)
    .map((s) => ({ id: s.id, type: s.signal_type, chip: s.chip, summary: s.summary, at: s.published_at }));
}

export function buildViews(
  accounts: Account[],
  signals: Signal[],
  activities: Activity[],
  history: { account_id: string; score: number; created_at: string }[],
  contacts: { id: string; full_name: string }[],
  news: { account_id: string; title: string; ai_one_liner: string | null; published_at: string | null; url: string; source_name: string | null }[] = [],
): AccountView[] {
  const today = new Date().toISOString().slice(0, 10);
  return accounts.map((a) => {
    const acts = activities.filter((x) => x.account_id === a.id);
    const r = readiness(a, acts);
    const spark = history
      .filter((h) => h.account_id === a.id)
      .slice(0, 8)
      .reverse()
      .map((h) => Number(h.score));
    return {
      ...a,
      latest: news
        .filter((n) => n.account_id === a.id)
        .slice(0, 3)
        .map((n) => ({ text: n.ai_one_liner ?? n.title, title: n.title, at: n.published_at, url: n.url, source: n.source_name })),
      warmth_score: Number(a.warmth_score),
      readiness: r,
      chips: chipsFor(a, signals),
      spark,
      followUpDue: r.state === "follow_up" || (!!a.next_step_due && a.next_step_due <= today && r.state !== "paused"),
      recommendedContact: contacts.find((c) => c.id === a.recommended_contact_id)?.full_name ?? null,
    };
  });
}

export function heatGrid(accounts: AccountView[], signals: Signal[], days = 14) {
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const WEIGHT: Record<string, number> = {
    leadership_hire: 30,
    headcount_expansion: 28,
    funding_round: 25,
    workforce_digitalisation: 22,
    operational_challenge: 20,
    expansion_geo: 18,
    m_and_a: 15,
  };
  return {
    days: dayKeys,
    rows: accounts.map((a) => ({
      id: a.id,
      name: a.company_name,
      tier: a.warmth_tier,
      cells: dayKeys.map((d) => {
        const sigs = signals.filter((s) => s.account_id === a.id && (s.published_at ?? "").slice(0, 10) === d);
        return {
          strength: sigs.reduce((t, s) => t + (WEIGHT[s.signal_type] ?? 15) * Number(s.confidence), 0),
          headlines: sigs.filter((s) => s.is_cluster_lead).map((s) => ({ type: s.signal_type, text: s.chip ? `${s.chip} — ${s.summary}` : s.summary })),
        };
      }),
    })),
  };
}
