import { describe, expect, it } from "vitest";
import { clusterSignals, scoreAccount, type SignalRow } from "@/lib/pipeline/score";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const DAY = 86_400_000;
let n = 0;
const sig = (p: Partial<SignalRow> & { daysAgo: number }): SignalRow => ({
  id: `s${++n}`,
  signal_type: "headcount_expansion",
  chip: "new stores",
  summary: "Company opens new stores",
  evidence_snippet: null,
  confidence: 1,
  published_at: new Date(NOW - p.daysAgo * DAY).toISOString(),
  detected_at: new Date(NOW).toISOString(),
  cluster_id: null,
  is_cluster_lead: true,
  corroborations: 0,
  event_key: null,
  ...p,
});

describe("scoreAccount", () => {
  it("applies base × confidence × half-life decay", () => {
    // headcount_expansion: base 28, half-life 14d → 14 days old = exactly half.
    const { score, breakdown } = scoreAccount([sig({ daysAgo: 14 })], "prospect", null, NOW);
    expect(breakdown[0].decay).toBeCloseTo(0.5, 3);
    expect(score).toBeCloseTo(14, 1);
  });

  it("counts only the top 3 events and caps at 100", () => {
    const many = Array.from({ length: 6 }, () => sig({ daysAgo: 0, signal_type: "leadership_hire" }));
    const { score, breakdown } = scoreAccount(many, "prospect", null, NOW);
    expect(breakdown.filter((b) => b.counted)).toHaveLength(3);
    expect(score).toBe(100); // 3 × 30 × 1.2 (prospect) = 108 → capped
  });

  it("applies stage multipliers (customer ×1.3 on expansion)", () => {
    const c = scoreAccount([sig({ daysAgo: 0 })], "customer", null, NOW);
    const p = scoreAccount([sig({ daysAgo: 0 })], "pilot", null, NOW);
    expect(c.score).toBeCloseTo(28 * 1.3, 1);
    expect(p.score).toBeCloseTo(28, 1);
  });

  it("lets quiet accounts sink as signals age", () => {
    const fresh = scoreAccount([sig({ daysAgo: 1 })], "prospect", null, NOW).score;
    const old = scoreAccount([sig({ daysAgo: 60 })], "prospect", null, NOW).score;
    expect(old).toBeLessThan(fresh / 10);
  });

  it("maps tiers and trend", () => {
    const r = scoreAccount([sig({ daysAgo: 0, signal_type: "leadership_hire" }), sig({ daysAgo: 0 }), sig({ daysAgo: 0, signal_type: "funding_round" })], "pilot", 20, NOW);
    expect(r.tier).toBe("hot");
    expect(r.trend).toBe("rising");
  });

  it("corroboration adds +0.1 confidence per extra source, capped at 1", () => {
    const { breakdown } = scoreAccount([sig({ daysAgo: 0, confidence: 0.7, corroborations: 2 })], "pilot", null, NOW);
    expect(breakdown[0].confidence).toBeCloseTo(0.9, 2);
  });
});

describe("clusterSignals", () => {
  it("merges coverage of the same event (same type, key, within 3 days)", () => {
    const a = sig({ daysAgo: 1, event_key: "agra-232-keys", confidence: 0.8 });
    const b = sig({ daysAgo: 0, event_key: "agra-232-keys", confidence: 0.95 });
    clusterSignals([a, b]);
    expect(a.cluster_id).toBe(b.cluster_id);
    expect(b.is_cluster_lead).toBe(true);
    expect(a.is_cluster_lead).toBe(false);
    expect(b.corroborations).toBe(1);
  });

  it("keeps different events apart even when wording overlaps", () => {
    const a = sig({ daysAgo: 0, event_key: "gateway-agra", summary: "IHCL signs Gateway hotel" });
    const b = sig({ daysAgo: 0, event_key: "gateway-dirang", summary: "IHCL signs Gateway hotel" });
    clusterSignals([a, b]);
    expect(a.cluster_id).not.toBe(b.cluster_id);
  });

  it("ages an event from its first report, not the latest re-coverage", () => {
    const first = sig({ daysAgo: 2, event_key: "new-hr-head", confidence: 0.9 });
    const later = sig({ daysAgo: 0, event_key: "new-hr-head", confidence: 0.95 });
    const all = clusterSignals([first, later]);
    const { breakdown } = scoreAccount(all, "pilot", null, NOW);
    expect(breakdown[0].age_days).toBeCloseTo(2, 1);
  });

  it("never merges across the 3-day window", () => {
    const a = sig({ daysAgo: 10, event_key: "x" });
    const b = sig({ daysAgo: 0, event_key: "x" });
    clusterSignals([a, b]);
    expect(a.cluster_id).not.toBe(b.cluster_id);
  });
});
