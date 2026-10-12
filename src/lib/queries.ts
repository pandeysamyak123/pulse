// Server-side reads (anon key; RLS allows SELECT only).
import "server-only";
import { supabaseReader, must } from "./supabase";
import type { Account, Activity, Article, Contact, Digest, Draft, EmailRun, Note, ScanRun, Signal } from "./types";

const DAY = 86_400_000;
const db = () => supabaseReader();

export type HistoryPoint = { account_id: string; score: number; created_at: string };

export async function getShell() {
  const [accounts, run] = await Promise.all([
    db().from("accounts").select("id, company_name, domain, warmth_tier, warmth_score, stage").order("warmth_score", { ascending: false }),
    db().from("scan_runs").select("*").not("finished_at", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    accounts: must(accounts, "accounts") as Pick<Account, "id" | "company_name" | "domain" | "warmth_tier" | "warmth_score" | "stage">[],
    lastRun: (run.data ?? null) as ScanRun | null,
  };
}

export async function getToday() {
  const since14 = new Date(Date.now() - 14 * DAY).toISOString();
  const [accounts, contacts, signals, history, activities, runs] = await Promise.all([
    db().from("accounts").select("*").order("warmth_score", { ascending: false }),
    db().from("contacts").select("*"),
    db()
      .from("signals")
      .select("*, articles(url, source_name, title)")
      .gte("published_at", since14)
      .order("published_at", { ascending: false }),
    db().from("score_history").select("account_id, score, created_at").order("created_at", { ascending: false }).limit(400),
    db().from("activities").select("*").order("occurred_at", { ascending: false }),
    db().from("scan_runs").select("*").order("started_at", { ascending: false }).limit(2),
  ]);
  return {
    accounts: must(accounts, "accounts") as Account[],
    contacts: must(contacts, "contacts") as Contact[],
    signals: must(signals, "signals") as Signal[],
    history: must(history, "history") as HistoryPoint[],
    activities: must(activities, "activities") as Activity[],
    runs: must(runs, "runs") as ScanRun[],
  };
}

export async function getAccount(id: string) {
  const [account, contacts, signals, articles, drafts, activities, notes, digest, history] = await Promise.all([
    db().from("accounts").select("*").eq("id", id).maybeSingle(),
    db().from("contacts").select("*").eq("account_id", id).order("is_primary", { ascending: false }),
    db().from("signals").select("*, articles(url, source_name, title)").eq("account_id", id).order("published_at", { ascending: false }).limit(60),
    db().from("articles").select("*").eq("account_id", id).eq("is_about_company", true).order("published_at", { ascending: false }).limit(80),
    db().from("outreach_drafts").select("*").eq("account_id", id).eq("status", "draft").order("created_at", { ascending: false }),
    db().from("activities").select("*").eq("account_id", id).order("occurred_at", { ascending: false }),
    db().from("notes").select("*").eq("account_id", id).order("created_at", { ascending: false }),
    db().from("note_digests").select("*").eq("account_id", id).maybeSingle(),
    db().from("score_history").select("account_id, score, created_at").eq("account_id", id).order("created_at", { ascending: false }).limit(8),
  ]);
  const acc = must(account, "account") as Account | null;
  if (!acc) return null;
  return {
    account: acc,
    contacts: must(contacts, "contacts") as Contact[],
    signals: must(signals, "signals") as Signal[],
    articles: must(articles, "articles") as Article[],
    drafts: must(drafts, "drafts") as Draft[],
    activities: must(activities, "activities") as Activity[],
    notes: must(notes, "notes") as Note[],
    digest: (digest.data ?? null) as Digest | null,
    history: (must(history, "history") as HistoryPoint[]).reverse(),
  };
}

export async function getTriggers() {
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const [signals, accounts] = await Promise.all([
    db()
      .from("signals")
      .select("*, articles(url, source_name, title)")
      .gte("published_at", since)
      .eq("is_cluster_lead", true)
      .order("published_at", { ascending: false }),
    db().from("accounts").select("id, company_name, domain, warmth_tier, stage"),
  ]);
  return {
    signals: must(signals, "signals") as Signal[],
    accounts: must(accounts, "accounts") as Pick<Account, "id" | "company_name" | "domain" | "warmth_tier" | "stage">[],
  };
}

export async function getRuns() {
  return must(await db().from("scan_runs").select("*").order("started_at", { ascending: false }).limit(50), "runs") as ScanRun[];
}

export async function getEmails() {
  return must(await db().from("email_runs").select("*").order("sent_at", { ascending: false }).limit(50), "emails") as EmailRun[];
}
