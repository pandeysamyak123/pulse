import { describe, expect, it } from "vitest";
import { checkDrafts, enforceLimits, triggerTerms, unsupportedNumbers, type DraftSet } from "@/lib/pipeline/draft-checks";

const facts = "Ather crossed 8 lakh cumulative sales. New Maharashtra plant. Paused until 2027-01-05.";
const terms = [triggerTerms("New Maharashtra Plant", "Ather expands production with a new Maharashtra plant")];
const base: DraftSet = {
  email: { subject: "Ather's Maharashtra plant", body: "Kavya, the new Maharashtra plant means more shift rosters. Worth a 20-minute call next week?" },
  linkedin_connect: "Kavya — saw the new Maharashtra plant news. Would like to connect.",
  linkedin_dm: "Kavya, with the new Maharashtra plant coming up, rostering gets harder. Open to a short chat? – Arjun",
  followup: "",
};

describe("draft quality gate", () => {
  it("passes a grounded draft", () => {
    expect(checkDrafts(base, terms, true, facts)).toEqual([]);
  });

  it("catches the real hallucinations we saw (false claims, flattery, invented figures)", () => {
    const bad = {
      ...base,
      email: {
        subject: "Ather",
        body: "Kavya, Ather's 8 lakh sales are impressive. Now that your HRMS migration is complete, ShiftSense has helped similar manufacturers cut overtime 18%.",
      },
    };
    const issues = checkDrafts(bad, terms, true, facts).join(" | ");
    expect(issues).toContain('"impressive"');
    expect(issues).toContain('"now that your"');
    expect(issues).toContain('"has helped similar"');
    expect(issues).toContain("18");
  });

  it("requires a cold opener to name the trigger", () => {
    const vague = { ...base, email: { subject: "Quick intro", body: "Hi Kavya, we do workforce software. Call next week?" } };
    expect(checkDrafts(vague, terms, true, facts)).toContain("email does not mention a specific trigger");
  });

  it("enforces LinkedIn's 280-character connection-note limit", () => {
    const long = { ...base, linkedin_connect: "x ".repeat(200) };
    expect(checkDrafts(long, terms, true, facts).some((i) => i.startsWith("linkedin_connect is"))).toBe(true);
    expect(enforceLimits(long).linkedin_connect.length).toBeLessThanOrEqual(280);
  });

  it("allows real figures and call lengths, flags invented ones", () => {
    expect(unsupportedNumbers("adds 1,600 beds; 20-minute call; 45% cut", "1,600 bed expansion")).toEqual(["45"]);
  });
});
