import { describe, expect, it } from "vitest";
import { formatMotion } from "./minutes";
import { canCloseEarly, computeDisposition, parseRollCall, presentAttendees, rollCallVoters, tally } from "./votes";

const att = [
  { id: "1", person_name: "Ana", status: "present", is_voting: true },
  { id: "2", person_name: "Ben", status: "remote", is_voting: true },
  { id: "3", person_name: "Cy", status: "absent", is_voting: true },
  { id: "4", person_name: "Guest", status: "present", is_voting: false },
];

describe("motion voting", () => {
  it("only present or remote attendees can move or second", () => {
    expect(presentAttendees(att).map((a) => a.person_name)).toEqual(["Ana", "Ben", "Guest"]);
  });
  it("roll call lists present voting members only", () => {
    expect(rollCallVoters(att).map((a) => a.person_name)).toEqual(["Ana", "Ben"]);
  });
  it("totals come from the roll call", () => {
    expect(tally([{ attendance_id: "1", person_name: "Ana", vote: "yes" }, { attendance_id: "2", person_name: "Ben", vote: "abstain" }])).toEqual({ votes_yes: 1, votes_no: 0, votes_abstain: 1 });
  });
  it("bad roll-call entries are ignored", () => {
    expect(parseRollCall([{ person_name: "A", vote: "maybe" }, null, { person_name: "B", vote: "no" }])).toHaveLength(1);
    expect(parseRollCall({})).toEqual([]);
  });
  it("minutes name each member's vote when a roll call was taken", () => {
    const text = formatMotion({ agenda_item_id: null, motion_text: "Approve budget", votes_yes: 1, votes_no: 1, votes_abstain: 0, outcome: "failed",
      roll_call: [{ person_name: "Ana", vote: "yes" }, { person_name: "Ben", vote: "no" }] });
    expect(text).toContain("Roll call — in favor: Ana; opposed: Ben.");
  });
  it("minutes without a roll call keep totals only", () => {
    expect(formatMotion({ agenda_item_id: null, motion_text: "X", votes_yes: 3, votes_no: 0, votes_abstain: 0, outcome: "carried" })).not.toContain("Roll call");
  });
});


describe("live vote results", () => {
  it("simple majority of votes cast ignores abstentions", () => {
    expect(computeDisposition("majority_cast", { yes: 2, no: 1 }, 5, true)).toBe("carried");
    expect(computeDisposition("majority_cast", { yes: 1, no: 1 }, 5, true)).toBe("failed");
  });
  it("majority of eligible voters present counts non-voters against", () => {
    expect(computeDisposition("majority_present", { yes: 2, no: 0 }, 5, true)).toBe("failed");
    expect(computeDisposition("majority_present", { yes: 3, no: 0 }, 5, true)).toBe("carried");
  });
  it("two-thirds of votes cast", () => {
    expect(computeDisposition("two_thirds_cast", { yes: 2, no: 1 }, 3, true)).toBe("carried");
    expect(computeDisposition("two_thirds_cast", { yes: 3, no: 2 }, 5, true)).toBe("failed");
  });
  it("no result without quorum, with a custom rule, or with no votes cast", () => {
    expect(computeDisposition("majority_cast", { yes: 3, no: 0 }, 3, false)).toBeNull();
    expect(computeDisposition("chair", { yes: 3, no: 0 }, 3, true)).toBeNull();
    expect(computeDisposition("majority_cast", { yes: 0, no: 0 }, 3, true)).toBeNull();
  });
  it("only permitted roles may close early, and only when chair-close is enabled", () => {
    const org = { vote_close_modes: ["chair"], vote_closer_roles: ["chair", "secretary"] };
    expect(canCloseEarly("chair", org)).toBe(true);
    expect(canCloseEarly("member", org)).toBe(false);
    expect(canCloseEarly("chair", { ...org, vote_close_modes: ["timer"] })).toBe(false);
  });
});
