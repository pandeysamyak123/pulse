import { describe, expect, it } from "vitest";
import { hasExcluded, isMarketNoise, mentionsCompany, normaliseUrl, prefilter } from "@/lib/pipeline/prefilter";
import type { AccountRow, RawItem } from "@/lib/pipeline/types";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const acc = (p: Partial<AccountRow>): AccountRow =>
  ({ id: "a", company_name: "X", search_aliases: [], exclude_terms: [], stage: "prospect", ...p }) as AccountRow;
const item = (title: string, p: Partial<RawItem> = {}): RawItem => ({
  title,
  url: `https://news.example/${encodeURIComponent(title)}`,
  source_name: "Example",
  published_at: new Date(NOW - 86_400_000).toISOString(),
  snippet: "",
  fetched_via: "google_news",
  query: "company",
  ...p,
});

describe("company mention", () => {
  it("matches whole names, not substrings inside other words", () => {
    const licious = acc({ company_name: "Licious", search_aliases: ["Licious"] });
    expect(mentionsCompany(licious, "Licious launches packaged momos")).toBe(true);
    expect(mentionsCompany(licious, "FOX 16 Food Spotlight: Mac-A-Licious")).toBe(false);
    expect(mentionsCompany(licious, "Apple-licious recipes for fall")).toBe(false);
  });

  it("honours exclude terms (Apollo Tyres is not Apollo Hospitals)", () => {
    const apollo = acc({ company_name: "Apollo Hospitals", exclude_terms: ["Apollo Tyres"] });
    expect(hasExcluded(apollo, "Apollo Tyres sells ₹500 crore NCDs")).toBe(true);
    expect(hasExcluded(apollo, "Apollo Hospitals adds 1,600 beds")).toBe(false);
  });
});

describe("prefilter", () => {
  const dmart = acc({ company_name: "Avenue Supermarts", search_aliases: ["DMart"] });

  it("dedupes near-identical titles and stored URLs, drops stale items", () => {
    const items = [
      item("DMart opens 15 new stores in Q2"),
      item("DMart opens 15 new stores in Q2 FY27", { url: "https://other.example/x" }),
      item("DMart quarterly update", { url: "https://stored.example/1" }),
      item("DMart old news", { published_at: new Date(NOW - 20 * 86_400_000).toISOString() }),
      item("Unrelated retailer expands"),
    ];
    const { kept, stats } = prefilter(dmart, items, new Set(["https://stored.example/1"]), { now: NOW });
    // one copy of the duplicated story survives (either is correct — same timestamp)
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toMatch(/^DMart opens 15 new stores in Q2/);
    expect(stats.dropped.alreadyStored).toBe(1);
    expect(stats.dropped.stale).toBe(1);
    expect(stats.dropped.noMention).toBe(1);
  });

  it("spends the cap on likely triggers before market chatter", () => {
    const items = [
      item("DMart share price target raised by brokerage", { published_at: new Date(NOW - 1000).toISOString() }),
      item("DMart adds 15 stores", { query: "expansion" }),
    ];
    const { kept } = prefilter(dmart, items, new Set(), { now: NOW, cap: 1 });
    expect(kept[0].title).toBe("DMart adds 15 stores");
  });

  it("normalises tracking params out of URLs", () => {
    expect(normaliseUrl("https://www.site.com/a/?utm_source=x&id=2#top")).toBe("https://site.com/a/?id=2");
  });

  it("recognises market noise", () => {
    expect(isMarketNoise("Lenskart Shares Slide 5% As Block Deals Drive Heavy Trading")).toBe(true);
    expect(isMarketNoise("IHCL signs 232-key Gateway hotel in Agra")).toBe(false);
  });
});
