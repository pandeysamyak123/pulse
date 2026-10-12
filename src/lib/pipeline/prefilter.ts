// Step 2 — Deterministic prefilter (no AI). Normalise + dedupe, require a
// company/alias mention, drop exclude_terms and already-stored URLs, keep the
// N most recent.
import type { AccountRow, FetchStats, RawItem } from "./types";

export const MAX_PER_ACCOUNT = 12;
export const WINDOW_DAYS = 7;

export function normaliseUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|ocid|cmpid|oc$)/i.test(k)) url.searchParams.delete(k);
    }
    url.hostname = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return u.trim();
  }
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9₹ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

function similar(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function mentionsCompany(a: Pick<AccountRow, "company_name" | "search_aliases">, text: string) {
  const names = [a.company_name, ...a.search_aliases].filter(Boolean);
  // Hyphens/apostrophes count as part of a word so "Mac-A-Licious" never matches "Licious".
  return names.some((n) =>
    new RegExp(`(^|[^a-z0-9\\-'’])${escapeRe(n.toLowerCase())}([^a-z0-9\\-]|$)`, "i").test(text.toLowerCase()),
  );
}

export function hasExcluded(a: Pick<AccountRow, "exclude_terms">, text: string) {
  const t = text.toLowerCase();
  return a.exclude_terms.some((x) => x && t.includes(x.toLowerCase()));
}

/** Pure market-commentary headlines: kept for the feed only if there is room. */
const MARKET_NOISE = [
  /\b(share price|target price|price target|top (gainers|losers)|nifty|sensex|vwap|52[- ]week|open interest|buy,? sell or hold|bulk deals?|block deals?|brokerages?|intraday|f&o|market cap|watchlist|stocks? (in news|to (buy|watch))|top stocks|sold off|stock forecast|price and chart|rated (buy|sell|hold)|upside|on road price)\b/i,
  /\b(stocks?|shares?)\b.{0,40}\b(falls?|falling|fell|slips?|slides?|slumps?|tumbles?|drops?|rises?|rising|jumps?|surges?|gains?|rall(y|ies)|trades?|trading)\b/i,
  /\btarget (of )?(rs\.?|₹|inr)\s?[\d,]+/i,
];

export const isMarketNoise = (title: string) => MARKET_NOISE.some((re) => re.test(title));

/** 0 = topic-query hit (most likely a trigger), 1 = general company news, 2 = market noise. */
function priority(it: RawItem) {
  if (isMarketNoise(it.title)) return 2;
  return it.query === "company" || it.query === "gdelt" ? 1 : 0;
}

export function prefilter(
  a: AccountRow,
  items: RawItem[],
  storedUrls: Set<string>,
  now = Date.now(),
): { kept: RawItem[]; stats: Omit<FetchStats, "queries" | "sourceErrors"> } {
  const dropped = { noMention: 0, excluded: 0, alreadyStored: 0, stale: 0, overCap: 0 };

  // Newest first so dedupe keeps the most recent copy; Google News preferred over GDELT on ties.
  const sorted = [...items]
    .filter((i) => i.title && i.url)
    .sort(
      (x, y) =>
        (Date.parse(y.published_at ?? "") || 0) - (Date.parse(x.published_at ?? "") || 0) ||
        (x.fetched_via === "google_news" ? -1 : 1),
    );

  const seenUrl = new Set<string>();
  const seenTitles: Set<string>[] = [];
  const deduped: RawItem[] = [];
  const isTopic = (q: string) => q !== "company" && q !== "gdelt";
  for (const it of sorted) {
    const url = normaliseUrl(it.url);
    const tk = tokens(it.title);
    let dup = seenUrl.has(url) ? deduped.findIndex((d) => d.url === url) : -1;
    if (dup < 0) dup = seenTitles.findIndex((s) => similar(s, tk) >= 0.8);
    if (dup >= 0) {
      // Same story from a topic query is a stronger hint than the plain company feed: keep that label.
      if (isTopic(it.query) && !isTopic(deduped[dup].query)) deduped[dup] = { ...deduped[dup], query: it.query };
      continue;
    }
    seenUrl.add(url);
    seenTitles.push(tk);
    deduped.push({ ...it, url });
  }

  const cutoff = now - WINDOW_DAYS * 86_400_000;
  const kept: RawItem[] = [];
  for (const it of deduped) {
    const text = `${it.title} ${it.snippet}`;
    const ts = Date.parse(it.published_at ?? "");
    if (ts && ts < cutoff) dropped.stale++;
    else if (!mentionsCompany(a, text)) dropped.noMention++;
    else if (hasExcluded(a, text)) dropped.excluded++;
    else if (storedUrls.has(it.url)) dropped.alreadyStored++;
    else kept.push(it);
  }
  dropped.overCap = Math.max(0, kept.length - MAX_PER_ACCOUNT);
  // Spend the 12-item budget on likely triggers first, then general news, then market chatter;
  // newest first within each tier.
  kept.sort((x, y) => priority(x) - priority(y) || (Date.parse(y.published_at ?? "") || 0) - (Date.parse(x.published_at ?? "") || 0));

  return {
    kept: kept.slice(0, MAX_PER_ACCOUNT),
    stats: { fetched: items.length, afterDedupe: deduped.length, afterPrefilter: Math.min(kept.length, MAX_PER_ACCOUNT), dropped },
  };
}
