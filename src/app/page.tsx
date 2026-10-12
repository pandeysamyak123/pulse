import { getToday } from "@/lib/queries";
import { buildViews, heatGrid, tierFor } from "@/lib/derive";
import { TodayView } from "@/components/today";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function TodayPage() {
  const data = await getToday();
  const views = buildViews(data.accounts, data.signals, data.activities, data.history, data.contacts);

  // KPIs
  const now = Date.now();
  const leads = data.signals.filter((s) => s.is_cluster_lead);
  const in72 = leads.filter((s) => now - Date.parse(s.published_at ?? s.detected_at) <= 3 * DAY).length;
  const prev72 = leads.filter((s) => {
    const age = now - Date.parse(s.published_at ?? s.detected_at);
    return age > 3 * DAY && age <= 6 * DAY;
  }).length;
  const hot = views.filter((v) => v.warmth_tier === "hot").length;
  const prevHot = views.filter((v) => (v.spark.length >= 2 ? tierFor(v.spark[v.spark.length - 2]) === "hot" : false)).length;
  const lastRun = data.runs.find((r) => r.finished_at) ?? null;

  const reachOut = views
    .filter((v) => v.readiness.state !== "paused" && (v.warmth_score >= 15 || v.followUpDue))
    .sort((a, b) => b.warmth_score + (b.followUpDue ? 10 : 0) - (a.warmth_score + (a.followUpDue ? 10 : 0)))
    .slice(0, 4);

  return (
    <TodayView
      views={views}
      reachOut={reachOut.map((v) => v.id)}
      grid={heatGrid(views, data.signals)}
      kpis={{
        hot,
        hotDelta: hot - prevHot,
        triggers72: in72,
        triggersDelta: in72 - prev72,
        followUps: views.filter((v) => v.followUpDue).length,
        lastScanAt: lastRun?.finished_at ?? null,
        integrityOk: lastRun?.integrity_ok ?? null,
      }}
    />
  );
}
