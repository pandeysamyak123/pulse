import { describe, expect, it, vi } from "vitest";
import { readiness } from "@/lib/readiness";

const DAY = 86_400_000;
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

describe("outreach readiness (shown beside warmth, never changes it)", () => {
  it("respects Arjun's pause", () => {
    expect(readiness({ last_contact_date: null, do_not_contact_until: "2027-01-05" }, []).state).toBe("paused");
  });

  it("says wait after recent contact", () => {
    const r = readiness({ last_contact_date: iso(3).slice(0, 10), do_not_contact_until: null }, [
      { channel: "call", direction: "outbound", outcome: "follow_up", occurred_at: iso(3) },
    ]);
    expect(r.state).toBe("wait");
  });

  it("flags a follow-up after an unanswered email", () => {
    const r = readiness({ last_contact_date: iso(10).slice(0, 10), do_not_contact_until: null }, [
      { channel: "email", direction: "outbound", outcome: "no_reply", occurred_at: iso(10) },
    ]);
    expect(r).toEqual({ state: "follow_up", days: 10 });
  });

  it("is ready when nothing blocks outreach", () => {
    expect(readiness({ last_contact_date: null, do_not_contact_until: null }, []).state).toBe("ready");
  });
});
