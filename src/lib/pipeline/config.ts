import type { Stage } from "./types";

/** Base weight + half-life per signal type (mirrors the signal_types table). */
export const SIGNAL_CONFIG: Record<string, { label: string; base: number; halfLife: number }> = {
  leadership_hire: { label: "Leadership hire", base: 30, halfLife: 21 },
  headcount_expansion: { label: "Headcount expansion", base: 28, halfLife: 14 },
  funding_round: { label: "Funding round", base: 25, halfLife: 30 },
  workforce_digitalisation: { label: "Workforce digitalisation", base: 22, halfLife: 21 },
  operational_challenge: { label: "Operational challenge", base: 20, halfLife: 10 },
  expansion_geo: { label: "Geographic expansion", base: 18, halfLife: 14 },
  m_and_a: { label: "M&A / restructuring", base: 15, halfLife: 21 },
};

/**
 * Stage multipliers: customers ×1.3 on expansion signals (upsell),
 * prospects ×1.2 on leadership hires (a new buyer to win).
 */
export const STAGE_MULTIPLIERS: Partial<Record<Stage, Partial<Record<string, number>>>> = {
  customer: { headcount_expansion: 1.3, expansion_geo: 1.3 },
  prospect: { leadership_hire: 1.2 },
};

export const TIERS = [
  { tier: "hot", min: 60 },
  { tier: "warm", min: 35 },
  { tier: "cool", min: 15 },
  { tier: "quiet", min: 0 },
] as const;
export type Tier = (typeof TIERS)[number]["tier"];

export const tierFor = (score: number): Tier => TIERS.find((t) => score >= t.min)!.tier;

export const CLUSTER_WINDOW_DAYS = 3;
export const CORROBORATION_BOOST = 0.1;
export const SCORING_LOOKBACK_DAYS = 90;
export const TREND_DELTA = 3;
