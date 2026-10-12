export type Stage = "prospect" | "outreach" | "pilot" | "customer";

export type AccountRow = {
  id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  stage: Stage;
  search_aliases: string[];
  exclude_terms: string[];
  last_contact_date: string | null;
  do_not_contact_until: string | null;
  arjun_notes: string | null;
  relationship_read: string | null;
  next_step: string | null;
  warmth_score: number;
  warmth_tier: string;
};

/** A raw item from a live source, before any AI. */
export type RawItem = {
  title: string;
  url: string;
  source_name: string | null;
  published_at: string | null; // ISO
  snippet: string;
  fetched_via: "google_news" | "gdelt" | "newsroom";
  query: string;
};

export type FetchStats = {
  queries: number;
  fetched: number;
  afterDedupe: number;
  afterPrefilter: number;
  dropped: { noMention: number; excluded: number; alreadyStored: number; stale: number; overCap: number };
  sourceErrors: string[];
};
