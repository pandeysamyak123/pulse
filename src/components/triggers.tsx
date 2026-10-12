"use client";

import { ExternalLink, Quote, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ago, cn, fmtDate, SIGNAL_LABEL, TIER_META } from "@/lib/format";
import type { Account, Signal } from "@/lib/types";
import { EmptyState, Logo, OwnerTag, SIGNAL_ICON, SignalIcon, Tip } from "./ui";

type Acc = Pick<Account, "id" | "company_name" | "domain" | "warmth_tier" | "stage">;

export function TriggersFeed({ signals, accounts }: { signals: Signal[]; accounts: Acc[] }) {
  const [type, setType] = useState<string | null>(null);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const counts = new Map<string, number>();
  signals.forEach((s) => counts.set(s.signal_type, (counts.get(s.signal_type) ?? 0) + 1));
  const list = type ? signals.filter((s) => s.signal_type === type) : signals;

  const groups = new Map<string, Signal[]>();
  for (const s of list) {
    const k = (s.published_at ?? s.detected_at).slice(0, 10);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Zap className="h-5 w-5 text-warm" /> Triggers · last 14 days
        </h1>
        <OwnerTag owner="pulse" />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
        <button
          onClick={() => setType(null)}
          aria-pressed={!type}
          className={cn("h-8 rounded-full border px-3 text-xs", !type ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:text-text")}
        >
          All <span className="num ml-1 text-faint">{signals.length}</span>
        </button>
        {Object.keys(SIGNAL_ICON).map((t) => (
          <button
            key={t}
            onClick={() => setType(type === t ? null : t)}
            aria-pressed={type === t}
            disabled={!counts.get(t)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs disabled:opacity-35",
              type === t ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:text-text",
            )}
          >
            <SignalIcon type={t} /> {SIGNAL_LABEL[t]} <span className="num text-faint">{counts.get(t) ?? 0}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Zap className="h-6 w-6" />} title="No triggers in this window. Run a scan for fresh news." />
      ) : (
        [...groups.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="label mb-2">{fmtDate(day, { weekday: "long", day: "numeric", month: "short" })}</h2>
            <ul className="space-y-2">
              {items.map((s) => {
                const a = byId.get(s.account_id);
                if (!a) return null;
                return (
                  <li key={s.id} className="card flex gap-3 p-4">
                    <Link href={`/accounts/${a.id}`} className="shrink-0">
                      <Logo name={a.company_name} domain={a.domain} size={40} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/accounts/${a.id}`} className="font-semibold hover:underline">
                          {a.company_name}
                        </Link>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_META[a.warmth_tier].color }} aria-label={a.warmth_tier} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                          <SignalIcon type={s.signal_type} /> {s.chip || SIGNAL_LABEL[s.signal_type]}
                        </span>
                        <span className="num ml-auto text-xs text-faint">{ago(s.published_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{s.summary}</p>
                      {s.evidence_snippet && (
                        <p className="mt-1.5 flex gap-1.5 text-xs text-faint">
                          <Quote className="h-3 w-3 shrink-0" /> <span className="line-clamp-1">{s.evidence_snippet}</span>
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        {s.articles?.url && (
                          <a href={s.articles.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
                            {s.articles.source_name ?? "Source"} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {s.corroborations > 0 && <span className="text-faint">+{s.corroborations} more sources</span>}
                        <Tip label="Classifier confidence">
                          <span className="num text-faint">{Math.round(Number(s.confidence) * 100)}%</span>
                        </Tip>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
