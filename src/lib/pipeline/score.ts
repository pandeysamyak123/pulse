// Steps 4–5 — Cluster duplicate coverage of the same event, then score
// deterministically:
//   signal_score = base_weight × confidence × 0.5^(age_days / half_life) × stage_multiplier
//   warmth_score = min(100, sum of top-3 cluster scores)
import { randomUUID } from "crypto";
import {
  CLUSTER_WINDOW_DAYS,
  CORROBORATION_BOOST,
  SIGNAL_CONFIG,
  STAGE_MULTIPLIERS,
  TREND_DELTA,
  tierFor,
  type Tier,
} from "./config";
import type { Stage } from "./types";

export type SignalRow = {
  id: string;
  signal_type: string;
  chip: string | null;
  summary: string;
  evidence_snippet: string | null;
  confidence: number;
  published_at: string | null;
  detected_at: string;
  cluster_id: string | null;
  is_cluster_lead: boolean;
  corroborations: number;
  event_key?: string | null;
};

export type BreakdownEntry = {
  signal_id: string;
  type: string;
  label: string;
  chip: string | null;
  summary: string;
  base: number;
  confidence: number; // after corroboration boost
  corroborations: number;
  age_days: number;
  half_life: number;
  decay: number;
  stage_mult: number;
  score: number;
  counted: boolean; // in the top 3
};

const DAY = 86_400_000;
const keyTokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9₹ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
const STOP = new Set(["with", "from", "this", "that", "will", "into", "after", "over", "their", "company", "india", "indian", "signs", "new"]);

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

const ts = (s: SignalRow) => Date.parse(s.published_at ?? s.detected_at);

/**
 * Group coverage of the same event: same type, within 3 days, and either the
 * same Gemini event_key or (when a key is missing) strongly overlapping key nouns.
 * Different event_keys never merge, so 4 hotel signings stay 4 events.
 */
export function clusterSignals(signals: SignalRow[]): SignalRow[] {
  const sorted = [...signals].sort((a, b) => ts(a) - ts(b));
  const clusters: { id: string; type: string; key: string; members: SignalRow[]; tokens: Set<string> }[] = [];
  for (const s of sorted) {
    const tk = keyTokens(`${s.chip ?? ""} ${s.summary} ${s.evidence_snippet ?? ""}`);
    const key = s.event_key ?? "";
    const hit = clusters.find(
      (c) =>
        c.type === s.signal_type &&
        c.members.some((m) => Math.abs(ts(m) - ts(s)) <= CLUSTER_WINDOW_DAYS * DAY) &&
        (key && c.key ? key === c.key : overlap(c.tokens, tk) >= 0.5),
    );
    if (hit) {
      hit.members.push(s);
      tk.forEach((t) => hit.tokens.add(t));
    } else {
      clusters.push({ id: randomUUID(), type: s.signal_type, key, members: [s], tokens: tk });
    }
  }
  for (const c of clusters) {
    const lead = c.members.reduce((best, m) => (m.confidence > best.confidence ? m : best), c.members[0]);
    for (const m of c.members) {
      m.cluster_id = c.id;
      m.is_cluster_lead = m === lead;
      m.corroborations = m === lead ? c.members.length - 1 : 0;
    }
  }
  return sorted;
}

export function scoreAccount(
  signals: SignalRow[],
  stage: Stage,
  prevScore: number | null,
  now = Date.now(),
): { score: number; tier: Tier; trend: "rising" | "steady" | "falling"; breakdown: BreakdownEntry[] } {
  // An event is as old as its FIRST report — later coverage corroborates, it doesn't reset decay.
  const firstSeen = new Map<string, number>();
  for (const s of signals) {
    const k = s.cluster_id ?? s.id;
    firstSeen.set(k, Math.min(firstSeen.get(k) ?? Infinity, ts(s)));
  }
  const entries: BreakdownEntry[] = signals
    .filter((s) => s.is_cluster_lead && SIGNAL_CONFIG[s.signal_type])
    .map((s) => {
      const cfg = SIGNAL_CONFIG[s.signal_type];
      const age = Math.max(0, (now - (firstSeen.get(s.cluster_id ?? s.id) ?? ts(s))) / DAY);
      const decay = Math.pow(0.5, age / cfg.halfLife);
      const conf = Math.min(1, s.confidence + CORROBORATION_BOOST * s.corroborations);
      const mult = STAGE_MULTIPLIERS[stage]?.[s.signal_type] ?? 1;
      const score = cfg.base * conf * decay * mult;
      return {
        signal_id: s.id,
        type: s.signal_type,
        label: cfg.label,
        chip: s.chip,
        summary: s.summary,
        base: cfg.base,
        confidence: round(conf, 2),
        corroborations: s.corroborations,
        age_days: round(age, 1),
        half_life: cfg.halfLife,
        decay: round(decay, 3),
        stage_mult: mult,
        score: round(score, 2),
        counted: false,
      };
    })
    .sort((a, b) => b.score - a.score);

  entries.slice(0, 3).forEach((e) => (e.counted = true));
  const score = round(Math.min(100, entries.slice(0, 3).reduce((s, e) => s + e.score, 0)), 1);
  const trend =
    prevScore == null ? "steady" : score - prevScore > TREND_DELTA ? "rising" : prevScore - score > TREND_DELTA ? "falling" : "steady";
  return { score, tier: tierFor(score), trend, breakdown: entries.slice(0, 8) };
}

function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
