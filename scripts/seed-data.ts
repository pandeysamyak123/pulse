// Seed data: 10 real Indian frontline-heavy companies with FICTIONAL manual
// fields, contacts, activities and notes. Contact emails are plus-addresses of
// DEMO_CONTACT_EMAIL so no real executive is ever emailed.

export const PRODUCT_PROFILE = {
  product_name: "ShiftSense",
  description:
    "Workforce management for frontline-heavy Indian businesses: shift scheduling and rostering, geo-fenced attendance, leave and overtime, payroll-ready exports, compliance with Indian labour codes and state Shops & Establishments rules, multi-site workforce analytics, contractor/gig workforce management, and a WhatsApp-based employee app.",
  buyers: "CHRO, VP Operations, COO, Head of Store/Hub Operations",
  best_fit: "Companies adding sites, stores, hubs, clinics or frontline headcount",
  sender_name: "Arjun Mehta",
  signature: "Arjun Mehta\nEnterprise Sales, ShiftSense",
};

type Contact = { key: string; full_name: string; title: string; is_primary?: boolean; notes?: string };
type Activity = {
  days_ago: number;
  channel: "email" | "linkedin" | "call" | "meeting" | "whatsapp" | "other";
  direction?: "outbound" | "inbound";
  contact?: string;
  subject?: string;
  body_sent?: string;
  outcome?: "no_reply" | "replied" | "meeting_booked" | "not_interested" | "follow_up";
  note?: string;
};
type Note = { days_ago: number; body: string; pinned?: boolean };

export type SeedAccount = {
  slug: string;
  company_name: string;
  domain: string;
  industry: string;
  hq_city: string;
  employee_band: string;
  stage: "prospect" | "outreach" | "pilot" | "customer";
  search_aliases: string[];
  exclude_terms: string[];
  arjun_notes: string;
  relationship_read: string;
  next_step?: string;
  next_step_due_in_days?: number;
  do_not_contact_until?: string;
  contacts: Contact[];
  activities: Activity[];
  notes: Note[];
};

export const ACCOUNTS: SeedAccount[] = [
  {
    slug: "zepto",
    company_name: "Zepto",
    domain: "zeptonow.com",
    industry: "Quick commerce",
    hq_city: "Mumbai",
    employee_band: "5,000+ (plus large gig fleet)",
    stage: "prospect",
    search_aliases: ["Zepto", "Kiranakart"],
    exclude_terms: ["zeptosecond", "Zepto Cafe recipe"],
    arjun_notes: "Dark-store rollout is the wedge. Rostering for pickers/packers across 3 shifts is chaotic per ex-employee.",
    relationship_read: "Cold. No warm intro yet; a mutual connection at their Bengaluru ops team.",
    next_step: "Find the right ops leader and send a first touch",
    next_step_due_in_days: 2,
    contacts: [
      { key: "zepto-ops", full_name: "Rhea Kapoor", title: "VP Operations, Dark Stores", is_primary: true },
      { key: "zepto-hr", full_name: "Nikhil Rao", title: "Head of People, Supply Chain" },
    ],
    activities: [
      { days_ago: 40, channel: "linkedin", contact: "zepto-ops", body_sent: "Connection request sent (no note).", outcome: "no_reply", note: "Generic request, should have added a note." },
    ],
    notes: [
      { days_ago: 41, body: "Spoke to an ex-Zepto store manager at a meetup: shift swaps are managed on WhatsApp groups; attendance disputes common.", pinned: true },
      { days_ago: 12, body: "They are hiring heavily for dark-store managers across Pune and Hyderabad per job boards." },
    ],
  },
  {
    slug: "delhivery",
    company_name: "Delhivery",
    domain: "delhivery.com",
    industry: "Logistics",
    hq_city: "Gurugram",
    employee_band: "25,000+",
    stage: "pilot",
    search_aliases: ["Delhivery"],
    exclude_terms: [],
    arjun_notes: "Pilot live in 3 NCR hubs (Bilaspur, Tauru, Mundka) since August. Attendance accuracy up; roster adoption slower.",
    relationship_read: "Warm. Champion is Vikram (Hub Ops). Procurement will want ROI numbers before scale-up.",
    next_step: "Share 60-day pilot readout with Vikram",
    next_step_due_in_days: 4,
    contacts: [
      { key: "del-ops", full_name: "Vikram Sethi", title: "Head of Hub Operations, North", is_primary: true, notes: "Prefers WhatsApp. Data-driven." },
      { key: "del-hr", full_name: "Ananya Iyer", title: "Director HR, Operations" },
    ],
    activities: [
      { days_ago: 70, channel: "meeting", contact: "del-ops", subject: "Pilot scoping", outcome: "meeting_booked", note: "Agreed 3-hub pilot, 90 days." },
      { days_ago: 30, channel: "call", contact: "del-ops", outcome: "replied", note: "Week-4 check-in. Supervisors like geo-fencing; want Hindi UI in app." },
      { days_ago: 8, channel: "whatsapp", contact: "del-ops", outcome: "replied", note: "Vikram asked for overtime cost comparison vs last quarter." },
    ],
    notes: [
      { days_ago: 29, body: "Promised Hindi language support in the WhatsApp app by end of October.", pinned: true },
      { days_ago: 8, body: "Need OT cost delta for the 60-day readout. Ask CS for the export." },
    ],
  },
  {
    slug: "lenskart",
    company_name: "Lenskart",
    domain: "lenskart.com",
    industry: "Omnichannel eyewear retail",
    hq_city: "Gurugram",
    employee_band: "10,000+",
    stage: "customer",
    search_aliases: ["Lenskart"],
    exclude_terms: [],
    arjun_notes: "Customer since Jan on 900 stores. Expansion conversation open: remaining stores + the new factory workforce.",
    relationship_read: "Strong. Exec sponsor happy; renewal in Feb. Upsell to factory + international stores possible.",
    next_step: "Send expansion proposal for 600 additional stores",
    next_step_due_in_days: 0,
    contacts: [
      { key: "lk-chro", full_name: "Meera Bhatia", title: "CHRO", is_primary: true },
      { key: "lk-retail", full_name: "Karan Malhotra", title: "VP Retail Operations" },
      { key: "lk-mfg", full_name: "Suresh Natarajan", title: "Head of Manufacturing Ops" },
    ],
    activities: [
      { days_ago: 45, channel: "meeting", contact: "lk-retail", subject: "QBR", outcome: "follow_up", note: "QBR went well. Karan raised scheduling for new stores opening in Q4." },
      { days_ago: 14, channel: "email", contact: "lk-chro", subject: "Expanding ShiftSense to new stores", body_sent: "Hi Meera, following the QBR, sharing a short note on extending ShiftSense to the stores opening this year...", outcome: "replied", note: "Meera replied: interested, wants pricing for 600 stores." },
    ],
    notes: [
      { days_ago: 44, body: "Karan: new stores ramp with 6–8 staff each; rostering takes store managers ~5 hrs/week.", pinned: true },
      { days_ago: 13, body: "Pricing for 600 stores: check with deal desk for volume tier." },
    ],
  },
  {
    slug: "apollo",
    company_name: "Apollo Hospitals",
    domain: "apollohospitals.com",
    industry: "Healthcare",
    hq_city: "Chennai",
    employee_band: "70,000+",
    stage: "outreach",
    search_aliases: ["Apollo Hospitals", "Apollo HealthCo", "Apollo 24|7", "Apollo Hospitals Enterprise"],
    exclude_terms: ["Apollo Tyres", "Apollo Micro Systems", "Apollo Global", "Apollo Pipes"],
    arjun_notes: "Nursing rostering across clinics is the use case. Email to CHRO office 10 days ago, no reply.",
    relationship_read: "Cold-to-lukewarm. Large org; need a clinic-ops champion rather than corporate HR.",
    next_step: "Follow up on unanswered email",
    next_step_due_in_days: -1,
    contacts: [
      { key: "ap-hr", full_name: "Lakshmi Venkatesan", title: "Group CHRO", is_primary: true },
      { key: "ap-clinic", full_name: "Rahul Menon", title: "COO, Apollo Clinics" },
    ],
    activities: [
      { days_ago: 10, channel: "email", contact: "ap-hr", subject: "Nurse rostering across Apollo clinics", body_sent: "Hi Lakshmi, Apollo is adding clinics and diagnostic centres at a fast clip. ShiftSense helps hospital groups roster nurses and technicians across sites with labour-code compliance built in. Would a 20-min look be useful next week?\n\nArjun", outcome: "no_reply" },
    ],
    notes: [
      { days_ago: 11, body: "Exclude Apollo Tyres in search, lots of noise.", pinned: true },
    ],
  },
  {
    slug: "ihcl",
    company_name: "Indian Hotels Company",
    domain: "ihcltata.com",
    industry: "Hospitality",
    hq_city: "Mumbai",
    employee_band: "35,000+",
    stage: "prospect",
    search_aliases: ["IHCL", "Indian Hotels Company", "Taj Hotels", "Ginger Hotels"],
    exclude_terms: ["Taj Mahal"],
    arjun_notes: "Ginger/Gateway brand expansion means many new properties with lean staff. Good WFM fit.",
    relationship_read: "No relationship. Tata group procurement is slow; target property-ops leadership.",
    contacts: [
      { key: "ihcl-hr", full_name: "Farah Khan", title: "EVP Human Resources", is_primary: true },
      { key: "ihcl-ops", full_name: "Arvind Shetty", title: "SVP Operations, Ginger" },
    ],
    activities: [],
    notes: [
      { days_ago: 20, body: "Look for new hotel signings news, each is a staffing event." },
    ],
  },
  {
    slug: "shadowfax",
    company_name: "Shadowfax",
    domain: "shadowfax.in",
    industry: "Last-mile logistics",
    hq_city: "Bengaluru",
    employee_band: "3,000+ (plus 100k+ gig riders)",
    stage: "outreach",
    search_aliases: ["Shadowfax", "Shadowfax Technologies"],
    exclude_terms: ["Gandalf", "Lord of the Rings"],
    arjun_notes: "Gig rider + hub staff mix. Contractor workforce module is the hook.",
    relationship_read: "Opened. Intro call 3 days ago went OK; they want a case study from logistics.",
    next_step: "Send Delhivery-style case study (anonymised)",
    next_step_due_in_days: 3,
    contacts: [
      { key: "sf-ops", full_name: "Aditya Rao", title: "COO", is_primary: true },
      { key: "sf-hr", full_name: "Pooja Reddy", title: "VP People" },
    ],
    activities: [
      { days_ago: 18, channel: "linkedin", contact: "sf-ops", body_sent: "Hi Aditya, noticed Shadowfax adding hubs across tier-2 cities. Would love to connect.", outcome: "replied", note: "Accepted and replied, suggested a call." },
      { days_ago: 3, channel: "call", contact: "sf-ops", outcome: "follow_up", note: "30-min intro. Pain: rider attendance and hub shift coverage during sale events. Wants case study." },
    ],
    notes: [
      { days_ago: 3, body: "Promised: anonymised logistics case study + pricing for 120 hubs by Thursday.", pinned: true },
    ],
  },
  {
    slug: "dmart",
    company_name: "Avenue Supermarts",
    domain: "dmartindia.com",
    industry: "Grocery retail",
    hq_city: "Mumbai",
    employee_band: "60,000+",
    stage: "prospect",
    search_aliases: ["DMart", "D-Mart", "Avenue Supermarts"],
    exclude_terms: [],
    arjun_notes: "Store count growing ~40/yr. Conservative buyer; in-house HRMS. Angle: store-level rostering + compliance only.",
    relationship_read: "No contact yet. Known to be cost-focused and build-heavy.",
    contacts: [
      { key: "dm-hr", full_name: "Sanjay Kulkarni", title: "Head of HR", is_primary: true },
    ],
    activities: [],
    notes: [
      { days_ago: 25, body: "Lead with cost: overtime leakage + compliance penalties, not features." },
    ],
  },
  {
    slug: "licious",
    company_name: "Licious",
    domain: "licious.in",
    industry: "D2C meat & seafood",
    hq_city: "Bengaluru",
    employee_band: "3,000+",
    stage: "pilot",
    search_aliases: ["Licious", "Delightful Gourmet"],
    exclude_terms: ["recipe", "-licious"],
    arjun_notes: "Pilot in 2 Bengaluru processing centres. Cold-chain shift compliance is the value.",
    relationship_read: "Warm. Pilot sponsor is the Head of Supply Chain; HR neutral.",
    next_step: "Mid-pilot review call",
    next_step_due_in_days: 6,
    contacts: [
      { key: "lic-sc", full_name: "Deepa Narayan", title: "Head of Supply Chain", is_primary: true },
      { key: "lic-hr", full_name: "Rohan Joshi", title: "HR Business Partner" },
    ],
    activities: [
      { days_ago: 35, channel: "meeting", contact: "lic-sc", subject: "Pilot kickoff", outcome: "meeting_booked", note: "Kicked off pilot in 2 centres." },
      { days_ago: 15, channel: "email", contact: "lic-sc", subject: "Pilot week 3 update", body_sent: "Hi Deepa, quick week-3 update: attendance capture at 96% across both centres...", outcome: "replied" },
    ],
    notes: [
      { days_ago: 15, body: "Deepa wants the night-shift overtime report in the next review." },
    ],
  },
  {
    slug: "ather",
    company_name: "Ather Energy",
    domain: "atherenergy.com",
    industry: "EV manufacturing & retail",
    hq_city: "Bengaluru",
    employee_band: "4,000+",
    stage: "prospect",
    search_aliases: ["Ather Energy", "Ather Rizta", "Ather 450"],
    exclude_terms: ["aether", "on road price", "album"],
    arjun_notes: "Hosur plant + experience centres. They asked us to come back next quarter after their HRMS migration.",
    relationship_read: "Polite pause. Head of Plant HR liked the demo but timing is wrong.",
    do_not_contact_until: "2027-01-05",
    next_step: "Re-engage in January after HRMS migration",
    next_step_due_in_days: 85,
    contacts: [
      { key: "ath-hr", full_name: "Kavya Srinivasan", title: "Head of HR, Manufacturing", is_primary: true },
    ],
    activities: [
      { days_ago: 21, channel: "meeting", contact: "ath-hr", subject: "Demo", outcome: "follow_up", note: "Good demo. Asked us to pause until Jan; HRMS migration in progress." },
    ],
    notes: [
      { days_ago: 21, body: "PAUSED until 5 Jan. Do not contact before then.", pinned: true },
    ],
  },
  {
    slug: "max",
    company_name: "Max Healthcare",
    domain: "maxhealthcare.in",
    industry: "Healthcare",
    hq_city: "New Delhi",
    employee_band: "20,000+",
    stage: "customer",
    search_aliases: ["Max Healthcare", "Max Hospital"],
    exclude_terms: ["Max Life", "Max Financial", "Max Estates", "Mad Max"],
    arjun_notes: "Customer on 8 hospitals for nursing rosters. New hospitals coming online = expansion.",
    relationship_read: "Good. Sponsor is the Chief Nursing Officer; renewal due in May.",
    next_step: "Check onboarding plan for upcoming hospital openings",
    next_step_due_in_days: 10,
    contacts: [
      { key: "max-cno", full_name: "Sunita Arora", title: "Chief Nursing Officer", is_primary: true },
      { key: "max-hr", full_name: "Amit Bansal", title: "Group CHRO" },
    ],
    activities: [
      { days_ago: 60, channel: "meeting", contact: "max-cno", subject: "Half-year review", outcome: "replied", note: "Nurse overtime down 11% in 6 months (their number)." },
      { days_ago: 25, channel: "call", contact: "max-hr", outcome: "follow_up", note: "Amit mentioned bed capacity expansion; wants to discuss new hospitals in Q4." },
    ],
    notes: [
      { days_ago: 25, body: "Expansion: new hospitals need rosters from day one. Offer onboarding pack.", pinned: true },
    ],
  },
];
