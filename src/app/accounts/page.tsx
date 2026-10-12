import type { Metadata } from "next";
import Link from "next/link";
import { getToday } from "@/lib/queries";
import { buildViews } from "@/lib/derive";
import { STAGE_LABEL } from "@/lib/format";
import { Logo, StageChip, TriggerChip } from "@/components/ui";
import { WarmthRing } from "@/components/viz";
import { ReadinessBadge } from "@/components/today";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const d = await getToday();
  const views = buildViews(d.accounts, d.signals, d.activities, d.history, d.contacts);
  const stages = Object.keys(STAGE_LABEL);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
        <span className="text-sm text-muted">{views.length} accounts · sorted by warmth</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((st) => {
          const col = views.filter((v) => v.stage === st).sort((a, b) => b.warmth_score - a.warmth_score);
          return (
            <section key={st} aria-label={STAGE_LABEL[st]} className="rounded-2xl border border-line bg-surface/50 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                <StageChip stage={st} />
                <span className="num text-xs text-faint">{col.length}</span>
              </h2>
              <div className="space-y-2.5">
                {col.map((v) => (
                  <Link key={v.id} href={`/accounts/${v.id}`} className="card block p-3 transition-colors hover:border-line-strong">
                    <div className="flex items-center gap-2.5">
                      <Logo name={v.company_name} domain={v.domain} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{v.company_name}</span>
                        <span className="block truncate text-xs text-faint">{v.industry}</span>
                      </span>
                      <WarmthRing score={v.warmth_score} tier={v.warmth_tier} size={40} stroke={4} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {v.chips.slice(0, 1).map((c) => (
                        <TriggerChip key={c.id} type={c.type} chip={c.chip} at={c.at} summary={c.summary} tier={v.warmth_tier} />
                      ))}
                      {v.readiness.state !== "ready" && <ReadinessBadge r={v.readiness} />}
                    </div>
                  </Link>
                ))}
                {!col.length && <p className="px-1 py-4 text-center text-xs text-faint">No accounts</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
