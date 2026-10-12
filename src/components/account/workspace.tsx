"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Newspaper, Send, Users, History as HistoryIcon, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn, fmtDateTime } from "@/lib/format";
import type { Readiness } from "@/lib/readiness";
import type { Account, Activity, Article, Contact, Digest, Draft, Note, Signal } from "@/lib/types";
import { ReadinessBadge } from "../today";
import { Button, Logo, StageChip, TierBadge, TrendArrow } from "../ui";
import { Sparkline, WarmthRing } from "../viz";
import { Overview } from "./overview";
import { Updates } from "./updates";
import { Outreach } from "./outreach";
import { HistoryTab } from "./history";
import { ContactsTab } from "./contacts";

export type WorkspaceProps = {
  account: Account;
  contacts: Contact[];
  signals: Signal[];
  articles: Article[];
  drafts: Draft[];
  activities: Activity[];
  notes: Note[];
  digest: Digest | null;
  history: { score: number; created_at: string }[];
  readiness: Readiness;
  initialTab: string;
  initialLog: string | null;
  authed: boolean;
  safeMode: boolean;
  demoInbox: string;
};

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "updates", label: "Updates", icon: Newspaper },
  { id: "outreach", label: "Outreach", icon: Send },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "contacts", label: "Contacts", icon: Users },
];

export function AccountWorkspace(p: WorkspaceProps) {
  const [tab, setTab] = useState(TABS.some((t) => t.id === p.initialTab) ? p.initialTab : "overview");
  const a = p.account;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (tab !== "history") url.searchParams.delete("log");
    window.history.replaceState(null, "", url);
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [cmdk-root]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "d") setTab("outreach");
      else if (k === "l" || k === "n") {
        e.preventDefault();
        setTab("history");
        setTimeout(() => document.getElementById(k === "l" ? "log-activity" : "add-note")?.focus(), 60);
      } else if (/^[1-5]$/.test(k)) setTab(TABS[Number(k) - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unread = p.articles.filter((x) => Date.now() - Date.parse(x.published_at ?? "") < 3 * 86_400_000).length;

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-bg/85 px-4 pb-3 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Link href="/" className="mb-2 inline-flex items-center gap-1 text-xs text-faint hover:text-text">
          <ArrowLeft className="h-3 w-3" /> Today
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <Logo name={a.company_name} domain={a.domain} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{a.company_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <TierBadge tier={a.warmth_tier} />
              <StageChip stage={a.stage} />
              <ReadinessBadge r={p.readiness} />
              {a.domain && (
                <a href={`https://${a.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-text">
                  {a.domain} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <span className="hidden sm:inline">· scanned {fmtDateTime(a.last_scanned_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <Sparkline points={p.history.map((h) => Number(h.score))} tier={a.warmth_tier} width={96} height={28} />
              <TrendArrow trend={a.score_trend} />
            </div>
            <WarmthRing score={a.warmth_score} tier={a.warmth_tier} size={64} breakdown={a.score_breakdown} />
            {tab !== "outreach" && (
              <span className="hidden sm:block">
                <Button variant="primary" onClick={() => setTab("outreach")}>
                  <Send className="h-4 w-4" /> Draft outreach
                </Button>
              </span>
            )}
          </div>
        </div>
        <div role="tablist" aria-label="Account sections" className="-mb-3 mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              title={`${t.label} (${i + 1})`}
              className={cn(
                "relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm transition-colors",
                tab === t.id ? "text-text" : "text-muted hover:text-text",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "updates" && unread > 0 && <span className="num rounded-full bg-surface-3 px-1.5 text-[10px] text-muted">{unread}</span>}
              {t.id === "outreach" && p.drafts.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {tab === t.id && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          {tab === "overview" && <Overview {...p} goTo={setTab} />}
          {tab === "updates" && <Updates articles={p.articles} signals={p.signals} />}
          {tab === "outreach" && <Outreach {...p} />}
          {tab === "history" && <HistoryTab {...p} />}
          {tab === "contacts" && <ContactsTab account={a} contacts={p.contacts} authed={p.authed} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
