// Phase 2 check: fetch + prefilter for every account, print counts and sample headlines.
// Read-only — writes nothing.  Usage: npx tsx scripts/fetch-preview.ts [--days30]
import { config } from "dotenv";
config({ path: ".env.local" });

import pLimit from "p-limit";
import { supabaseAdmin, must } from "../src/lib/supabase";
import { fetchAccount, fetchGoogleNews, fetchGdeltAll, companyClause } from "../src/lib/pipeline/fetch";
import { prefilter, mentionsCompany, isMarketNoise } from "../src/lib/pipeline/prefilter";
import type { AccountRow } from "../src/lib/pipeline/types";

async function main() {
  const db = supabaseAdmin();
  const accounts = must(await db.from("accounts").select("*").order("company_name"), "accounts") as AccountRow[];
  const stored = must(await db.from("articles").select("account_id, url"), "articles") as { account_id: string; url: string }[];
  const limit = pLimit(4);
  const t0 = Date.now();
  const gdeltPool = await fetchGdeltAll(accounts).catch((e) => {
    console.log(`GDELT: ${e.message}`);
    return [];
  });
  console.log(`GDELT pool: ${gdeltPool.length} articles in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const rows = await Promise.all(
    accounts.map((a) =>
      limit(async () => {
        const storedUrls = new Set(stored.filter((s) => s.account_id === a.id).map((s) => s.url));
        const { items, queries, errors } = await fetchAccount(a, gdeltPool);
        const { kept, stats } = prefilter(a, items, storedUrls);
        // 30-day freshness check for the "swap if no news" rule.
        const month = await fetchGoogleNews(`${companyClause(a)} when:30d`, "30d").catch(() => []);
        const month30 = month.filter((m) => mentionsCompany(a, m.title)).length;
        return { a, queries, errors, kept, stats, gdelt: gdeltPool.length, month30 };
      }),
    ),
  );

  console.log(`\nFetched in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  console.log("Account                  queries  fetched(GN+GDELT)  deduped  kept  dropped[noMention/excluded/stored/stale/cap]  30d-mentions");
  for (const r of rows) {
    const d = r.stats.dropped;
    console.log(
      `${r.a.company_name.padEnd(24)} ${String(r.queries).padStart(5)}  ${String(r.stats.fetched).padStart(5)} (GN ${r.stats.fetched - r.gdelt})`.padEnd(52) +
        `${String(r.stats.afterDedupe).padStart(6)}  ${String(r.stats.afterPrefilter).padStart(4)}  ` +
        `${d.noMention}/${d.excluded}/${d.alreadyStored}/${d.stale}/${d.overCap}`.padEnd(46) +
        `${r.month30}`,
    );
    if (r.errors.length) console.log(`    ! ${r.errors.join("; ")}`);
  }
  for (const r of rows) {
    console.log(`\n── ${r.a.company_name} (${r.kept.length} kept)`);
    for (const k of r.kept.slice(0, 5)) {
      const d = k.published_at ? k.published_at.slice(0, 10) : "????-??-??";
      console.log(`   ${d}  [${k.fetched_via === "gdelt" ? "GDELT" : "GN"}·${k.query}${isMarketNoise(k.title) ? "·mkt" : ""}] ${k.title.slice(0, 105)}  — ${k.source_name ?? ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
