// Row shapes as read by the UI.
export type Tier = "hot" | "warm" | "cool" | "quiet";
export type Stage = "prospect" | "outreach" | "pilot" | "customer";

export type BreakdownEntry = {
  signal_id: string;
  type: string;
  label: string;
  chip: string | null;
  summary: string;
  base: number;
  confidence: number;
  corroborations: number;
  age_days: number;
  half_life: number;
  decay: number;
  stage_mult: number;
  score: number;
  counted: boolean;
};

export type Account = {
  id: string;
  company_name: string;
  domain: string | null;
  industry: string | null;
  hq_city: string | null;
  employee_band: string | null;
  stage: Stage;
  search_aliases: string[];
  exclude_terms: string[];
  last_contact_date: string | null;
  arjun_notes: string | null;
  relationship_read: string | null;
  next_step: string | null;
  next_step_due: string | null;
  do_not_contact_until: string | null;
  warmth_score: number;
  warmth_tier: Tier;
  score_trend: "rising" | "steady" | "falling";
  score_breakdown: BreakdownEntry[];
  top_signal_id: string | null;
  signal_summary: string | null;
  why_now: string | null;
  outreach_angle: string | null;
  company_brief: string[] | null;
  recommended_contact_id: string | null;
  recommended_contact_reason: string | null;
  signals_last_3d: number;
  signals_last_14d: number;
  last_signal_at: string | null;
  last_scanned_at: string | null;
};

export type Contact = {
  id: string;
  account_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type Signal = {
  id: string;
  account_id: string;
  article_id: string;
  signal_type: string;
  chip: string | null;
  summary: string;
  evidence_snippet: string | null;
  confidence: number;
  relevance_reason: string | null;
  people_mentioned: string[];
  cluster_id: string | null;
  is_cluster_lead: boolean;
  corroborations: number;
  published_at: string | null;
  detected_at: string;
  articles?: { url: string; source_name: string | null; title: string } | null;
};

export type Article = {
  id: string;
  account_id: string;
  title: string;
  url: string;
  source_name: string | null;
  published_at: string | null;
  is_about_company: boolean;
  is_trigger: boolean;
  ai_one_liner: string | null;
};

export type Draft = {
  id: string;
  account_id: string;
  contact_id: string | null;
  channel: "email" | "linkedin_connect" | "linkedin_dm" | "linkedin_followup";
  subject: string | null;
  body: string;
  based_on_signal_id: string | null;
  tone: string;
  quality_flags: string[];
  status: "draft" | "used" | "discarded";
  created_at: string;
};

export type Activity = {
  id: string;
  account_id: string;
  contact_id: string | null;
  channel: "email" | "linkedin" | "call" | "meeting" | "whatsapp" | "other";
  direction: "outbound" | "inbound";
  subject: string | null;
  body_sent: string | null;
  outcome: "no_reply" | "replied" | "meeting_booked" | "not_interested" | "follow_up" | null;
  note: string | null;
  occurred_at: string;
  created_via: "manual" | "send_button" | "linkedin_mark_sent";
  draft_id: string | null;
};

export type Note = { id: string; account_id: string; body: string; pinned: boolean; created_at: string };

export type Digest = {
  account_id: string;
  digest: string;
  open_loops: string[];
  suggested_next_step: string | null;
  generated_at: string;
};

export type ScanRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  status: string;
  accounts_scanned: number;
  articles_fetched: number;
  articles_after_prefilter: number;
  articles_stored: number;
  signals_created: number;
  drafts_created: number;
  gemini_calls: number;
  tokens: number;
  errors: { company: string; error: string }[];
  summary: { models?: Record<string, number> };
  arjun_hash_before: string | null;
  arjun_hash_after: string | null;
  integrity_ok: boolean | null;
};

export type EmailRun = {
  id: string;
  sent_at: string;
  kind: string;
  recipient: string;
  subject: string | null;
  account_ids: string[];
  html: string | null;
  status: string;
  provider_id: string | null;
  error: string | null;
};
