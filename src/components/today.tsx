"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, BellRing, Clock, Flame, Pause, Send, ShieldCheck, Sparkles, X, Zap, Hourglass, CircleCheck, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AccountView } from "@/lib/derive";
import { ago, cn, fmtDate, STAGE_LABEL, TIER_META } from "@/lib/format";
import { readinessLabel, type Readiness } from "@/lib/readiness";
import type { Tier } from "@/lib/types";
import { Button, Kbd, Logo, OwnerTag, StageChip, Tip, TierBadge, TrendArrow, TriggerChip } from "./ui";
import { CountUp, HeatGrid, Sparkline, WarmthRing, type HeatCell } from "./viz";

type Kpis = {
  hot: number;
  hotDelta: number;
  triggers72: number;
  triggersDelta: number;
  followUps: number;
  lastScanAt: string | null;
  integrityOk: boolean | null;
};

const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.22, ease: "easeOut" as const } }),
};

export function TodayView({
  views,
  reachOut,
  grid,
  kpis,
}: {
  views: AccountView[];
  reachOut: string[];
  grid: { days: string[]; rows: { id: string; name: string; tier: Tier; cells: HeatCell[] }[] };
  kpis: Kpis;
}) {
  const [drawer, setDrawer] = useState<AccountView | null>(null);
  const byId = useMemo(() => new Map(views.map((v) => [v.id, v])), [views]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Today</h1>
      <KpiStrip kpis={kpis} />

      <section aria-labelledby="reach-out">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="reach-out" className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent-text" /> Reach out today
          </h2>
          <OwnerTag owner="pulse" />
        </div>
        {reachOut.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reachOut.map((id, i) => (
              <motion.div key={id} custom={i} variants={rise} initial="hidden" animate="show">
                <ReachCard v={byId.get(id)!} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card px-6 py-8 text-center text-sm text-muted">Nobody needs a nudge today. Run a scan for fresh signals.</div>
        )}
      </section>

      <section aria-labelledby="heat" className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="heat" className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-warm" /> Signal radar · 14 days
          </h2>
          <span className="hidden text-xs text-faint sm:block">Hover a cell for headlines · click to open</span>
        </div>
        <HeatGrid rows={grid.rows} days={grid.days} />
      </section>

      <RankedTable views={views} onQuickLook={setDrawer} />

      <Drawer v={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/* ───────── KPI tiles ───────── */
function KpiStrip({ kpis }: { kpis: Kpis }) {
  const tiles = [
    { label: "Hot accounts", value: kpis.hot, delta: kpis.hotDelta, icon: Flame, color: "var(--hot)", href: "/?tier=hot" },
    { label: "New triggers · 72h", value: kpis.triggers72, delta: kpis.triggersDelta, icon: Zap, color: "var(--warm)", href: "/triggers" },
    { label: "Follow-ups due", value: kpis.followUps, delta: null, icon: BellRing, color: "var(--cool)", href: "/?filter=followup" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div key={t.label} custom={i} variants={rise} initial="hidden" animate="show">
          <Link href={t.href} className="card group flex h-full flex-col gap-2 p-4 transition-colors hover:border-line-strong">
            <span className="flex items-center justify-between">
              <span className="label">{t.label}</span>
              <t.icon className="h-4 w-4" style={{ color: t.color }} />
            </span>
            <span className="flex items-baseline gap-2">
              <CountUp value={t.value} className="text-3xl font-semibold" />
              {t.delta != null && t.delta !== 0 && (
                <span className={cn("num text-xs", t.delta > 0 ? "text-ok" : "text-bad")}>
                  {t.delta > 0 ? "▲" : "▼"} {Math.abs(t.delta)}
                </span>
              )}
            </span>
          </Link>
        </motion.div>
      ))}
      <motion.div custom={3} variants={rise} initial="hidden" animate="show">
        <Link href="/runs" className="card flex h-full flex-col gap-2 p-4 transition-colors hover:border-line-strong">
          <span className="flex items-center justify-between">
            <span className="label">Last scan</span>
            <ShieldCheck className={cn("h-4 w-4", kpis.integrityOk ? "text-ok" : "text-faint")} />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="num text-3xl font-semibold">{ago(kpis.lastScanAt)}</span>
            <span className="text-xs text-muted">ago</span>
          </span>
          <span className={cn("text-[11px]", kpis.integrityOk ? "text-ok" : "text-faint")}>{kpis.integrityOk ? "Your data untouched ✓" : "—"}</span>
        </Link>
      </motion.div>
    </div>
  );
}

/* ───────── Readiness badge ───────── */
export function ReadinessBadge({ r, compact = false }: { r: Readiness; compact?: boolean }) {
  const meta = {
    paused: { icon: Pause, cls: "text-faint bg-surface-2" },
    wait: { icon: Hourglass, cls: "text-warm bg-[color-mix(in_oklab,var(--warm)_12%,transparent)]" },
    follow_up: { icon: BellRing, cls: "text-cool bg-[color-mix(in_oklab,var(--cool)_12%,transparent)]" },
    ready: { icon: CircleCheck, cls: "text-ok bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]" },
  }[r.state];
  const label = readinessLabel(r);
  return (
    <Tip label={label}>
      <span tabIndex={0} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.cls)}>
        <meta.icon className="h-3 w-3" />
        {!compact && <span className="truncate">{label}</span>}
      </span>
    </Tip>
  );
}

/* ───────── Reach-out card ───────── */
function ReachCard({ v }: { v: AccountView }) {
  return (
    <div
      className={cn(
        "card relative flex h-full flex-col gap-3 overflow-visible p-4 transition-colors hover:border-line-strong",
        v.warmth_tier === "hot" && "border-[color-mix(in_oklab,var(--hot)_35%,transparent)]",
      )}
    >
      {v.warmth_tier === "hot" && <div className="hot-gradient pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl" />}
      <div className="flex items-start gap-3">
        <Logo name={v.company_name} domain={v.domain} size={40} />
        <div className="min-w-0 flex-1">
          <Link href={`/accounts/${v.id}`} className="block truncate font-semibold hover:underline">
            {v.company_name}
          </Link>
          <span className="mt-1 flex items-center gap-1.5">
            <StageChip stage={v.stage} />
            <TrendArrow trend={v.score_trend} />
          </span>
        </div>
        <WarmthRing score={v.warmth_score} tier={v.warmth_tier} size={58} breakdown={v.score_breakdown} />
      </div>
      <div className="flex min-h-6 flex-wrap gap-1.5">
        {v.chips.length ? (
          v.chips.map((c) => <TriggerChip key={c.id} type={c.type} chip={c.chip} at={c.at} summary={c.summary} tier={v.warmth_tier} />)
        ) : (
          <span className="text-xs text-faint">No fresh trigger</span>
        )}
      </div>
      {v.why_now && (
        <Tip label={v.why_now} className="block">
          <p className="line-clamp-1 text-sm text-muted">{v.why_now}</p>
        </Tip>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <ReadinessBadge r={v.readiness} />
        <Link href={`/accounts/${v.id}?tab=outreach`}>
          <Button variant="primary" size="sm">
            <Send className="h-3.5 w-3.5" /> Draft outreach
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ───────── Ranked table with filters, sort, J/K ───────── */
type SortKey = "score" | "name" | "contact";

function RankedTable({ views, onQuickLook }: { views: AccountView[]; onQuickLook: (v: AccountView) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const tier = params.get("tier");
  const stage = params.get("stage");
  const followup = params.get("filter") === "followup";
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const [focus, setFocus] = useState(0);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v == null || p.get(k) === v) p.delete(k);
    else p.set(k, v);
    router.replace(`/?${p.toString()}`, { scroll: false });
  };

  const rows = useMemo(() => {
    let r = views;
    if (tier) r = r.filter((v) => v.warmth_tier === tier);
    if (stage) r = r.filter((v) => v.stage === stage);
    if (followup) r = r.filter((v) => v.followUpDue);
    const val = (v: AccountView) =>
      sort.key === "score" ? v.warmth_score : sort.key === "name" ? v.company_name.toLowerCase() : v.last_contact_date ?? "";
    return [...r].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [views, tier, stage, followup, sort]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable], [cmdk-root]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "j") setFocus((f) => Math.min(rows.length - 1, f + 1));
      else if (k === "k") setFocus((f) => Math.max(0, f - 1));
      else if (k === "enter" && rows[focus]) router.push(`/accounts/${rows[focus].id}`);
      else if (k === "d" && rows[focus]) router.push(`/accounts/${rows[focus].id}?tab=outreach`);
      else if (k === "l" && rows[focus]) router.push(`/accounts/${rows[focus].id}?tab=history&log=call`);
      else if (k === " " && rows[focus]) {
        e.preventDefault();
        onQuickLook(rows[focus]);
      } else return;
      document.getElementById(`row-${rows[Math.min(rows.length - 1, Math.max(0, focus))]?.id}`)?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, focus, router, onQuickLook]);

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button
      onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((s.dir * -1) as 1 | -1) : -1 }))}
      className="inline-flex items-center gap-0.5 hover:text-text"
      aria-label={`Sort by ${k}`}
    >
      {children}
      {sort.key === k && (sort.dir === -1 ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
    </button>
  );

  return (
    <section aria-labelledby="all" className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
        <h2 id="all" className="mr-2 text-sm font-semibold">
          All accounts
        </h2>
        {(["hot", "warm", "cool", "quiet"] as Tier[]).map((t) => (
          <FilterPill key={t} active={tier === t} onClick={() => setParam("tier", t)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_META[t].color }} />
            {TIER_META[t].label}
          </FilterPill>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-line-strong sm:block" />
        {Object.entries(STAGE_LABEL).map(([k, l]) => (
          <FilterPill key={k} active={stage === k} onClick={() => setParam("stage", k)}>
            {l}
          </FilterPill>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-line-strong sm:block" />
        <FilterPill active={followup} onClick={() => setParam("filter", "followup")}>
          <BellRing className="h-3 w-3" /> Needs follow-up
        </FilterPill>
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-faint lg:flex">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd> move · <Kbd>↵</Kbd> open · <Kbd>D</Kbd> draft · <Kbd>L</Kbd> log · <Kbd>␣</Kbd> peek
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="label border-b border-line text-left">
              <th className="px-4 py-2 font-medium">
                <SortBtn k="name">Account</SortBtn>
              </th>
              <th className="px-2 py-2 font-medium">Stage</th>
              <th className="px-2 py-2 font-medium">
                <SortBtn k="score">Warmth</SortBtn>
              </th>
              <th className="px-2 py-2 font-medium">Triggers</th>
              <th className="px-2 py-2 font-medium">
                <SortBtn k="contact">Last contact</SortBtn>
              </th>
              <th className="px-4 py-2 text-right font-medium">Momentum</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((v, i) => (
                <motion.tr
                  layout
                  key={v.id}
                  id={`row-${v.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => onQuickLook(v)}
                  onMouseEnter={() => setFocus(i)}
                  className={cn(
                    "cursor-pointer border-b border-line last:border-0 transition-colors",
                    focus === i ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                  aria-selected={focus === i}
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Logo name={v.company_name} domain={v.domain} size={28} />
                      <Link href={`/accounts/${v.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:underline">
                        {v.company_name}
                      </Link>
                      {v.followUpDue && (
                        <Tip label={v.readiness.state === "follow_up" ? readinessLabel(v.readiness) : `Next step due ${fmtDate(v.next_step_due)}`}>
                          <BellRing className="h-3.5 w-3.5 text-cool" />
                        </Tip>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <StageChip stage={v.stage} />
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2">
                      <WarmthRing score={v.warmth_score} tier={v.warmth_tier} size={30} stroke={3.5} showNumber={false} breakdown={v.score_breakdown} />
                      <span className={cn("num w-8 font-semibold", TIER_META[v.warmth_tier].cls)}>{v.warmth_score.toFixed(0)}</span>
                    </span>
                  </td>
                  <td className="max-w-[300px] px-2 py-2.5">
                    <span className="flex gap-1.5 overflow-hidden">
                      {v.chips.length ? (
                        v.chips.map((c) => <TriggerChip key={c.id} type={c.type} chip={c.chip} at={c.at} summary={c.summary} tier={v.warmth_tier} />)
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="h-3 w-3" />
                      <span className="num">{v.last_contact_date ? `${ago(v.last_contact_date)} ago` : "never"}</span>
                      {v.readiness.state !== "ready" && <ReadinessBadge r={v.readiness} compact />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center justify-end gap-2">
                      <Sparkline points={v.spark} tier={v.warmth_tier} />
                      <TrendArrow trend={v.score_trend} />
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && <p className="px-4 py-8 text-center text-sm text-muted">No accounts match these filters.</p>}
      </div>
    </section>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
        active ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-line-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

/* ───────── Quick-look drawer ───────── */
function Drawer({ v, onClose }: { v: AccountView | null; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <AnimatePresence>
      {v && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-[var(--overlay)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label={`${v.company_name} quick look`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="glass fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 overflow-y-auto p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <Logo name={v.company_name} domain={v.domain} size={44} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{v.company_name}</h2>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <TierBadge tier={v.warmth_tier} />
                  <StageChip stage={v.stage} />
                  <ReadinessBadge r={v.readiness} />
                </span>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-faint hover:text-text">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <WarmthRing score={v.warmth_score} tier={v.warmth_tier} size={76} stroke={7} breakdown={v.score_breakdown} />
              <div className="space-y-1">
                <Sparkline points={v.spark} tier={v.warmth_tier} width={140} height={34} />
                <span className="block text-xs text-faint">Click the ring for the score breakdown</span>
              </div>
            </div>
            <section className="space-y-2">
              <span className="flex items-center justify-between">
                <span className="label">Signals</span>
                <OwnerTag owner="pulse" />
              </span>
              <div className="flex flex-wrap gap-1.5">
                {v.chips.length ? v.chips.map((c) => <TriggerChip key={c.id} type={c.type} chip={c.chip} at={c.at} summary={c.summary} tier={v.warmth_tier} />) : <span className="text-sm text-faint">No fresh trigger</span>}
              </div>
              {v.why_now && <p className="text-sm text-muted">{v.why_now}</p>}
            </section>
            {v.company_brief?.length ? (
              <ul className="space-y-1.5 text-sm">
                {v.company_brief.map((b, i) => (
                  <li key={i} className="flex gap-2 text-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
            <section className="space-y-1.5 rounded-xl border border-line bg-surface-2 p-3">
              <span className="flex items-center justify-between">
                <span className="label">Next step</span>
                <OwnerTag owner="you" />
              </span>
              <p className="text-sm">{v.next_step ?? "—"}</p>
              {v.next_step_due && <p className="num text-xs text-faint">due {fmtDate(v.next_step_due)}</p>}
            </section>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Link href={`/accounts/${v.id}`}>
                <Button className="w-full">
                  Open <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/accounts/${v.id}?tab=outreach`}>
                <Button variant="primary" className="w-full">
                  <Send className="h-4 w-4" /> Draft
                </Button>
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
