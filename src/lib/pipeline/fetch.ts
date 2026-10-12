// Step 1 — Fetch live news for an account from Google News RSS (primary) and
// GDELT DOC 2.0 (secondary). No scraping of logged-in sites; LinkedIn is never touched.
import { XMLParser } from "fast-xml-parser";
import type { AccountRow, RawItem } from "./types";

const UA = "Mozilla/5.0 (compatible; PulseSignalMonitor/1.0; +https://github.com/pandeysamyak123/pulse)";
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const TOPICS: { key: string; clause: string }[] = [
  {
    key: "expansion",
    clause: `(hiring OR hire OR expansion OR expands OR "new stores" OR "new hubs" OR "dark stores" OR plant OR facility OR warehouse OR hospital OR clinics OR jobs)`,
  },
  {
    key: "leadership",
    clause: `(appoints OR appointed OR joins OR names OR elevates OR ropes) (CHRO OR "Chief People Officer" OR "Chief Human Resources" OR "VP Operations" OR COO OR "Chief Operating Officer" OR "HR head" OR CEO)`,
  },
  { key: "funding", clause: `(funding OR raises OR IPO OR "Series" OR acquisition OR acquires OR merger OR investment)` },
  {
    key: "workforce",
    clause: `(attrition OR strike OR protest OR "labour code" OR "labor code" OR compliance OR workforce OR employees OR layoffs OR "HR tech" OR digitalisation OR automation)`,
  },
];

export function companyClause(a: Pick<AccountRow, "company_name" | "search_aliases">) {
  const names = Array.from(new Set([a.company_name, ...a.search_aliases]))
    .filter((n) => n.length >= 3 && !/[|&]/.test(n))
    .map((n) => `"${n}"`);
  return names.length === 1 ? names[0] : `(${names.join(" OR ")})`;
}

export function buildGoogleQueries(a: AccountRow, days = 7): { key: string; q: string }[] {
  const who = companyClause(a);
  return [
    ...TOPICS.map((t) => ({ key: t.key, q: `${who} ${t.clause} when:${days}d` })),
    { key: "company", q: `${who} when:${days}d` }, // plain company-news query for the feed
  ];
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

export async function fetchGoogleNews(q: string, key: string): Promise<RawItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const body = await fetchText(url);
  const doc = xml.parse(body);
  const raw = doc?.rss?.channel?.item;
  const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map((it) => {
    const i = it as Record<string, unknown>;
    const src = i.source as { "#text"?: string } | string | undefined;
    const source_name = typeof src === "string" ? src : src?.["#text"] ?? null;
    let title = String(i.title ?? "");
    // Google appends " - Source" to every title.
    if (source_name && title.endsWith(` - ${source_name}`)) title = title.slice(0, -(source_name.length + 3));
    const pub = i.pubDate ? new Date(String(i.pubDate)) : null;
    return {
      title: title.trim(),
      url: String(i.link ?? ""),
      source_name,
      published_at: pub && !isNaN(+pub) ? pub.toISOString() : null,
      snippet: stripHtml(String(i.description ?? "")).slice(0, 500),
      fetched_via: "google_news" as const,
      query: key,
    };
  });
}

// GDELT asks for ≤1 request every 5s per client; serialize all calls through one queue.
let gdeltChain: Promise<unknown> = Promise.resolve();
let gdeltLast = 0;
function gdeltSlot<T>(fn: () => Promise<T>): Promise<T> {
  const run = gdeltChain.then(async () => {
    const wait = gdeltLast + 5_200 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    gdeltLast = Date.now();
    return fn();
  });
  gdeltChain = run.catch(() => undefined);
  return run;
}

/**
 * One GDELT request per scan covering every account (GDELT allows ~1 req / 5s);
 * results are attributed to accounts later by the deterministic mention check.
 */
export async function fetchGdeltAll(accounts: AccountRow[]): Promise<RawItem[]> {
  const names = Array.from(
    new Set(accounts.flatMap((a) => [a.company_name, ...a.search_aliases]).filter((n) => n.length >= 4 && !/[|&]/.test(n))),
  );
  const query = `(${names.map((n) => `"${n}"`).join(" OR ")}) sourcecountry:india sourcelang:english`;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&timespan=7d&maxrecords=250&sort=datedesc`;
  return gdeltSlot(async () => {
    const body = await fetchText(url, 20_000);
    if (!body.trim().startsWith("{")) throw new Error(`GDELT: ${body.slice(0, 80)}`);
    const data = JSON.parse(body) as { articles?: { url: string; title: string; seendate: string; domain: string }[] };
    return (data.articles ?? []).map((x) => {
      const m = x.seendate?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      return {
        title: x.title?.trim() ?? "",
        url: x.url,
        source_name: x.domain ?? null,
        published_at: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null,
        snippet: "",
        fetched_via: "gdelt" as const,
        query: "gdelt",
      };
    });
  });
}

/** All raw items for an account across sources. Source failures are reported, never thrown. */
export async function fetchAccount(a: AccountRow, gdeltPool: RawItem[] = [], days = 7) {
  const errors: string[] = [];
  const queries = buildGoogleQueries(a, days);
  const results = await Promise.all(
    queries.map((q) =>
      fetchGoogleNews(q.q, q.key).catch((e) => {
        errors.push(`google_news[${q.key}]: ${e.message}`);
        return [] as RawItem[];
      }),
    ),
  );
  // GDELT items come from the shared per-scan pool; the prefilter keeps only this account's mentions.
  return { items: [...results.flat(), ...gdeltPool], queries: queries.length, errors };
}
