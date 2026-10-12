// Small formatting helpers + shared UI vocabulary (client-safe).
import type { Tier } from "./types";

const DAY = 86_400_000;

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const ms = now - Date.parse(iso);
  if (ms < 60_000) return "now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < DAY) return `${Math.floor(ms / 3_600_000)}h`;
  const d = Math.floor(ms / DAY);
  if (d < 60) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

export const daysAgo = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : null);

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const TIER_META: Record<Tier, { label: string; color: string; cls: string }> = {
  hot: { label: "Hot", color: "var(--hot)", cls: "tier-hot" },
  warm: { label: "Warm", color: "var(--warm)", cls: "tier-warm" },
  cool: { label: "Cool", color: "var(--cool)", cls: "tier-cool" },
  quiet: { label: "Quiet", color: "var(--quiet)", cls: "tier-quiet" },
};

export const STAGE_LABEL: Record<string, string> = {
  prospect: "Prospect",
  outreach: "Outreach",
  pilot: "Pilot",
  customer: "Customer",
};

export const SIGNAL_LABEL: Record<string, string> = {
  leadership_hire: "Leadership",
  headcount_expansion: "Expansion",
  funding_round: "Funding",
  workforce_digitalisation: "Digitalisation",
  operational_challenge: "Ops pain",
  expansion_geo: "New market",
  m_and_a: "M&A",
};

export function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
