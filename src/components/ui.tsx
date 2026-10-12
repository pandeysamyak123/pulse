"use client";

import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  GitMerge,
  IndianRupee,
  MapPin,
  TrendingDown,
  TrendingUp,
  Minus,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ago, cn, initials, SIGNAL_LABEL, STAGE_LABEL, TIER_META } from "@/lib/format";
import type { Tier } from "@/lib/types";

/* ───────── Tooltip (CSS-only, keyboard-accessible via focus-within) ───────── */
export function Tip({
  label,
  children,
  side = "top",
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "right" | "left";
  className?: string;
}) {
  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
  }[side];
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-max max-w-64 rounded-lg px-2.5 py-1.5 text-xs leading-snug opacity-0 transition-opacity duration-150",
          "glass text-text shadow-lg group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          pos,
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* ───────── Buttons ───────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "outline", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-accent text-white shadow-[0_6px_20px_-6px_var(--accent)] hover:brightness-110 active:scale-[0.98]",
        variant === "outline" && "border border-line-strong bg-surface-2 text-text hover:bg-surface-3",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-text",
        variant === "danger" && "border border-line-strong text-bad hover:bg-surface-2",
        className,
      )}
    />
  );
});

/* ───────── Badges ───────── */
export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const m = TIER_META[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tier === "hot" ? "hot-gradient text-white" : "bg-surface-2",
        tier !== "hot" && m.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tier === "hot" ? "#fff" : m.color }} />
      {m.label}
    </span>
  );
}

export function StageChip({ stage }: { stage: string }) {
  return (
    <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

export function TrendArrow({ trend }: { trend: "rising" | "steady" | "falling" }) {
  const I = trend === "rising" ? TrendingUp : trend === "falling" ? TrendingDown : Minus;
  return (
    <Tip label={`Score ${trend} vs last scan`}>
      <I
        aria-label={`trend ${trend}`}
        className={cn("h-4 w-4", trend === "rising" ? "text-ok" : trend === "falling" ? "text-bad" : "text-faint")}
      />
    </Tip>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="num rounded border border-line-strong bg-surface-2 px-1.5 py-px text-[10px] text-muted">{children}</kbd>
  );
}

/* ───────── Signal icons + trigger chips ───────── */
export const SIGNAL_ICON: Record<string, LucideIcon> = {
  leadership_hire: UserPlus,
  headcount_expansion: ArrowUpRight,
  funding_round: IndianRupee,
  workforce_digitalisation: Zap,
  operational_challenge: AlertTriangle,
  expansion_geo: MapPin,
  m_and_a: GitMerge,
};

export function SignalIcon({ type, className }: { type: string; className?: string }) {
  const I = SIGNAL_ICON[type] ?? Zap;
  return <I aria-hidden className={cn("h-3.5 w-3.5", className)} />;
}

export function TriggerChip({
  type,
  chip,
  at,
  summary,
  tier,
}: {
  type: string;
  chip: string | null;
  at: string | null;
  summary?: string;
  tier?: Tier;
}) {
  const color = tier ? TIER_META[tier].color : "var(--accent-text)";
  return (
    <Tip label={summary ? <span><b className="font-semibold">{SIGNAL_LABEL[type]}</b> · {summary}</span> : SIGNAL_LABEL[type]}>
      <span
        tabIndex={0}
        className="lift inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 py-0.5 pl-1.5 pr-2 text-xs"
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}>
          <SignalIcon type={type} className="h-2.5 w-2.5" />
        </span>
        <span className="truncate font-medium text-text">{chip || SIGNAL_LABEL[type]}</span>
        <span className="num shrink-0 text-faint">{ago(at)}</span>
      </span>
    </Tip>
  );
}

/* ───────── Company logo (favicon service → initials fallback) ───────── */
export function Logo({ name, domain, size = 36 }: { name: string; domain: string | null; size?: number }) {
  const [failed, setFailed] = useState(!domain);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface-2 font-semibold text-muted"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {failed ? (
        initials(name)
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          width={size * 0.62}
          height={size * 0.62}
          className="rounded-md"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // Google returns a 16px generic globe when it has no icon: treat as missing.
            if ((e.target as HTMLImageElement).naturalWidth <= 16) setFailed(true);
          }}
        />
      )}
    </span>
  );
}

/* ───────── Ownership labels: 🤖 Found by Pulse vs ✍️ Yours ───────── */
export function OwnerTag({ owner }: { owner: "pulse" | "you" }) {
  return owner === "pulse" ? (
    <Tip label="Written by the Pulse pipeline (system-owned). Never touches your data.">
      <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-text">
        🤖 Found by Pulse
      </span>
    </Tip>
  ) : (
    <Tip label="Your data. Automation can never overwrite it (database-enforced).">
      <span className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text">
        ✍️ Yours
      </span>
    </Tip>
  );
}

export function EmptyState({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <p className="text-sm text-muted">{title}</p>
      {action}
    </div>
  );
}

/* ───────── LinkedIn mark (lucide ships no brand icons) ───────── */
export function Linkedin({ className, ...rest }: { className?: string; "aria-label"?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("h-4 w-4", className)} aria-hidden={!rest["aria-label"]} {...rest}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11.25H3V9.75Zm6.5 0h3.84v1.54h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-5.08c0-1.21-.02-2.77-1.69-2.77-1.69 0-1.95 1.32-1.95 2.68V21h-4V9.75Z" />
    </svg>
  );
}
