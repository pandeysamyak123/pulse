"use client";

import { ExternalLink, Newspaper, Zap } from "lucide-react";
import { useState } from "react";
import { cn, fmtDate, SIGNAL_LABEL } from "@/lib/format";
import type { Article, Signal } from "@/lib/types";
import { EmptyState, OwnerTag, SignalIcon } from "../ui";

export function Updates({ articles, signals }: { articles: Article[]; signals: Signal[] }) {
  const [onlyTriggers, setOnly] = useState(false);
  const sigByArticle = new Map(signals.map((s) => [s.article_id, s]));
  const list = onlyTriggers ? articles.filter((a) => a.is_trigger) : articles;

  // group by day
  const groups = new Map<string, Article[]>();
  for (const a of list) {
    const k = (a.published_at ?? "").slice(0, 10) || "unknown";
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {[
            { v: false, l: `All · ${articles.length}` },
            { v: true, l: `Triggers · ${articles.filter((a) => a.is_trigger).length}` },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setOnly(o.v)}
              aria-pressed={onlyTriggers === o.v}
              className={cn("rounded-lg px-3 py-1", onlyTriggers === o.v ? "bg-surface-3 text-text" : "text-muted hover:text-text")}
            >
              {o.l}
            </button>
          ))}
        </div>
        <OwnerTag owner="pulse" />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Newspaper className="h-6 w-6" />} title="No company news stored yet. Run a scan to pull the latest." />
      ) : (
        <ol className="relative space-y-6 border-l border-line pl-5">
          {[...groups.entries()].map(([day, items]) => (
            <li key={day}>
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-line-strong" />
              <h3 className="label mb-2">{day === "unknown" ? "Undated" : fmtDate(day, { weekday: "short", day: "numeric", month: "short" })}</h3>
              <ul className="space-y-2">
                {items.map((a) => {
                  const s = sigByArticle.get(a.id);
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        "card flex items-start gap-3 p-3",
                        a.is_trigger && "border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_6%,var(--surface))]",
                      )}
                    >
                      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", a.is_trigger ? "bg-accent text-white" : "bg-surface-2 text-faint")}>
                        {s ? <SignalIcon type={s.signal_type} className="h-4 w-4" /> : <Newspaper className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.ai_one_liner ?? a.title}</p>
                        <a href={a.url} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 truncate text-xs text-faint hover:text-accent-text">
                          <span className="truncate">{a.title}</span>
                          <span className="shrink-0">· {a.source_name}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      {s && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text">
                          <Zap className="h-3 w-3" />
                          {SIGNAL_LABEL[s.signal_type]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
