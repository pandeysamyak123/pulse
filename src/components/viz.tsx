"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn, fmtDate, SIGNAL_LABEL, TIER_META } from "@/lib/format";
import type { BreakdownEntry, Tier } from "@/lib/types";
import { SignalIcon, Tip } from "./ui";


/* ───────── Count-up number ───────── */
export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value); // server HTML shows the real number
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  const first = useRef(true);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const from = first.current ? 0 : mv.get();
    first.current = false;
    mv.set(from);
    const c = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span className={cn("num", className)}>{text}</motion.span>;
}

/* ───────── Warmth ring ───────── */
export function WarmthRing({
  score,
  tier,
  size = 64,
  stroke = 6,
  breakdown,
  showNumber = true,
}: {
  score: number;
  tier: Tier;
  size?: number;
  stroke?: number;
  breakdown?: BreakdownEntry[];
  showNumber?: boolean;
}) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = TIER_META[tier].color;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const ring = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn(tier === "hot" && "pulse-hot")} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          {tier === "hot" ? (
            <>
              <stop offset="0%" stopColor="var(--hot-2)" />
              <stop offset="100%" stopColor="var(--hot)" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} />
            </>
          )}
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#g${id})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        className="ring-fill"
        style={{ strokeDashoffset: c * (1 - pct), ["--from" as string]: c }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );

  return (
    <div ref={ref} className="relative inline-block" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (breakdown) setOpen((o) => !o);
        }}
        className={cn("relative block rounded-full", breakdown ? "cursor-pointer" : "cursor-default")}
        aria-label={`Warmth ${score.toFixed(0)} of 100, ${tier}${breakdown ? ". Click for score breakdown" : ""}`}
      >
        {ring}
        {showNumber && (
          <span className="absolute inset-0 grid place-items-center">
            <CountUp value={score} className="font-semibold text-text" />
          </span>
        )}
      </button>
      {open && breakdown && <ScoreExplainer breakdown={breakdown} score={score} tier={tier} />}
    </div>
  );
}

/* ───────── Score explainer: stacked bar of contributions + decay ───────── */
export function ScoreExplainer({ breakdown, score, tier, inline = false }: { breakdown: BreakdownEntry[]; score: number; tier: Tier; inline?: boolean }) {
  const counted = breakdown.filter((b) => b.counted);
  const raw = counted.reduce((s, b) => s + b.score, 0);
  const lost = counted.reduce((s, b) => s + (b.base * b.confidence * b.stage_mult - b.score), 0);
  const total = Math.max(100, raw + lost);
  const palette = ["var(--accent)", "var(--cool)", "var(--warm)"];
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        inline ? "w-full" : "glass absolute left-0 top-full z-40 mt-2 w-80 rounded-2xl p-4 shadow-2xl",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">Why {score.toFixed(0)}</span>
        <Tip label="signal = base weight × confidence × 0.5^(age ÷ half-life) × stage multiplier · warmth = top 3, capped at 100" side="left">
          <span className="cursor-help text-[11px] text-accent-text underline decoration-dotted">formula</span>
        </Tip>
      </div>
      {counted.length === 0 ? (
        <p className="text-sm text-muted">No live signals. Score decays to quiet automatically.</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3">
            {counted.map((b, i) => (
              <motion.div
                key={b.signal_id}
                initial={{ width: 0 }}
                animate={{ width: `${(b.score / total) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                style={{ background: palette[i] }}
              />
            ))}
            <div
              style={{ width: `${(lost / total) * 100}%`, background: "repeating-linear-gradient(45deg, var(--line-strong) 0 4px, transparent 4px 8px)" }}
              title="Lost to time decay"
            />
          </div>
          <ul className="mt-3 space-y-2">
            {counted.map((b, i) => (
              <li key={b.signal_id} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ background: palette[i] }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-medium text-text">
                    <SignalIcon type={b.type} />
                    <span className="truncate">{b.chip || SIGNAL_LABEL[b.type]}</span>
                  </span>
                  <span className="num text-faint">
                    {b.base}×{b.confidence}×{b.decay}
                    {b.stage_mult !== 1 ? `×${b.stage_mult}` : ""} · {b.age_days}d old
                    {b.corroborations ? ` · +${b.corroborations} src` : ""}
                  </span>
                </span>
                <span className="num font-semibold text-text">+{b.score.toFixed(1)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-xs text-faint">
              <span className="h-2 w-2 shrink-0 rounded-sm border border-line-strong" />
              <span className="flex-1">Lost to decay</span>
              <span className="num">−{lost.toFixed(1)}</span>
            </li>
          </ul>
        </>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs">
        <span className="text-muted">Tier</span>
        <span className={cn("font-semibold uppercase", TIER_META[tier].cls)}>{TIER_META[tier].label}</span>
      </div>
    </div>
  );
}

/* ───────── Momentum sparkline ───────── */
export function Sparkline({
  points,
  tier,
  width = 72,
  height = 24,
}: {
  points: number[];
  tier: Tier;
  width?: number;
  height?: number;
}) {
  const id = useId();
  if (points.length < 2) {
    return (
      <Tip label="Trend appears after 2+ scans">
        <svg width={width} height={height} aria-hidden>
          <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--line-strong)" strokeDasharray="2 3" />
        </svg>
      </Tip>
    );
  }
  // Fit to the data range (with headroom) so small moves stay visible and the fill stays a soft wash.
  const max = Math.max(...points) + 6;
  const min = Math.max(0, Math.min(...points) - 12);
  const step = width / (points.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
  const d = points.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const color = TIER_META[tier].color;
  return (
    <Tip label={`Last ${points.length} scans: ${points.map((p) => p.toFixed(0)).join(" → ")}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="score trend">
        <defs>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#s${id})`} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" />
        <circle cx={(points.length - 1) * step} cy={y(points[points.length - 1])} r={2.25} fill={color} />
      </svg>
    </Tip>
  );
}

/* ───────── Signal heat grid: accounts × last 14 days ───────── */
export type HeatCell = { strength: number; headlines: { type: string; text: string }[] };
export function HeatGrid({
  rows,
  days,
}: {
  rows: { id: string; name: string; tier: Tier; cells: HeatCell[] }[];
  days: string[]; // ISO dates oldest → newest
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.strength)));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid items-center gap-1" style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(0, 1fr))` }}>
          <span />
          {days.map((d, i) => (
            <span key={d} className={cn("num text-center text-[10px] text-faint", i % 2 === 1 && "opacity-0 sm:opacity-100")}>
              {i === days.length - 1 ? "today" : fmtDate(d, { day: "numeric" })}
            </span>
          ))}
          {rows.map((r, ri) => (
            <RowCells key={r.id} row={r} max={max} rowIndex={ri} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RowCells({ row, max, rowIndex }: { row: { id: string; name: string; tier: Tier; cells: HeatCell[] }; max: number; rowIndex: number }) {
  const color = TIER_META[row.tier].color;
  return (
    <>
      <Link href={`/accounts/${row.id}`} className="truncate pr-2 text-xs text-muted hover:text-text">
        {row.name}
      </Link>
      {row.cells.map((c, i) => {
        const t = c.strength / max;
        return c.strength > 0 ? (
          <Tip
            key={i}
            label={
              <span className="block space-y-1">
                {c.headlines.slice(0, 3).map((h, j) => (
                  <span key={j} className="flex items-start gap-1.5">
                    <SignalIcon type={h.type} className="mt-0.5 shrink-0" />
                    <span>{h.text}</span>
                  </span>
                ))}
              </span>
            }
            className="block"
          >
            <Link
              href={`/accounts/${row.id}`}
              aria-label={`${row.name}: ${c.headlines.length} signals`}
              className={cn("cell-in block h-6 w-full rounded-md transition-transform hover:scale-[1.18]", t > 0.7 && "cell-hot")}
              style={{
                animationDelay: `${150 + i * 35 + rowIndex * 20}ms`,
                background: `color-mix(in oklab, ${color} ${Math.round(25 + t * 75)}%, transparent)`,
                boxShadow: t > 0.6 ? `0 0 ${8 + t * 10}px color-mix(in oklab, ${color} 55%, transparent)` : undefined,
              }}
            />
          </Tip>
        ) : (
          <span key={i} className="block h-6 w-full rounded-md bg-surface-2" />
        );
      })}
    </>
  );
}
