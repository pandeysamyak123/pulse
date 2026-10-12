// Outreach readiness — shown next to warmth, never changes the score. Pure (client-safe).
const DAY = 86_400_000;

export type ReadinessActivity = {
  channel: string;
  direction: string;
  outcome: string | null;
  occurred_at: string;
};

export type Readiness =
  | { state: "paused"; until: string }
  | { state: "wait"; days: number; unanswered: boolean }
  | { state: "follow_up"; days: number }
  | { state: "ready" };

const daysSince = (d: string | null) => (d ? Math.floor((Date.now() - Date.parse(d)) / DAY) : null);

export function readiness(
  a: { last_contact_date: string | null; do_not_contact_until: string | null },
  activities: ReadinessActivity[], // newest first
): Readiness {
  const today = new Date().toISOString().slice(0, 10);
  if (a.do_not_contact_until && a.do_not_contact_until > today) return { state: "paused", until: a.do_not_contact_until };
  const since = daysSince(a.last_contact_date);
  const lastOut = activities.find((x) => x.direction === "outbound");
  const unanswered = !!lastOut && (lastOut.outcome === "no_reply" || lastOut.outcome == null) && lastOut.channel !== "meeting";
  if (since != null && since < 7) return { state: "wait", days: since, unanswered };
  if (unanswered && lastOut && daysSince(lastOut.occurred_at)! >= 5) return { state: "follow_up", days: daysSince(lastOut.occurred_at)! };
  return { state: "ready" };
}

export function readinessLabel(r: Readiness): string {
  switch (r.state) {
    case "paused":
      return `Paused until ${new Date(r.until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
    case "wait":
      return `Contacted ${r.days === 0 ? "today" : `${r.days}d ago`} — wait`;
    case "follow_up":
      return `No reply ${r.days}d — follow up`;
    default:
      return "Ready to reach out";
  }
}
