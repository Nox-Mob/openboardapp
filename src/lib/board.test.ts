import { describe, expect, it } from "vitest";
import { CAPABILITIES, can } from "./permissions";
import { generateMinutes, nextVersion, isEditable, currentApproved } from "./minutes";
import { escapeCell } from "./export";

describe("permissions table", () => {
  it("pins every capability", () => {
    expect(CAPABILITIES).toEqual({
      "org.manage": ["owner", "admin"],
      "members.invite": ["owner", "admin"],
      "records.edit": ["owner", "admin", "chair", "secretary"],
      "minutes.approve": ["owner", "admin", "chair", "secretary"],
      "audit.read": ["owner", "admin", "chair", "secretary"],
      "export.run": ["owner", "admin"],
      "records.read": ["owner", "admin", "chair", "secretary", "treasurer", "member", "observer"],
    });
  });
  it("members and observers cannot edit records", () => {
    expect(can("member", "records.edit")).toBe(false);
    expect(can("observer", "records.edit")).toBe(false);
    expect(can("secretary", "records.edit")).toBe(true);
    expect(can(null, "records.read")).toBe(false);
  });
});

describe("minutes", () => {
  const base = {
    orgName: "Thunderbird Chapter",
    meeting: { title: "Board Meeting", meeting_date: "2026-10-15" },
    attendance: [
      { person_name: "Ann", status: "present" },
      { person_name: "Ben", status: "absent" },
    ],
    agenda: [{ id: "a1", position: 0, title: "Budget", notes: "Reviewed." }],
    motions: [
      { agenda_item_id: "a1", motion_text: "Approve budget", moved_by: "Ann", seconded_by: null, votes_yes: 4, votes_no: 1, votes_abstain: 0, outcome: "carried" },
    ],
    quorum: 1,
  };
  it("includes the motion decision under its agenda item", () => {
    const text = generateMinutes(base);
    expect(text).toContain("MOTION: Approve budget (Moved by Ann). Vote: 4 in favor, 1 opposed, 0 abstaining. CARRIED.");
    expect(text.indexOf("1. Budget")).toBeLessThan(text.indexOf("MOTION"));
  });
  it("reports missing quorum", () => {
    expect(generateMinutes({ ...base, quorum: 3 })).toContain("NOT present (1 of 3 required)");
  });
  it("versions increase and only drafts are editable", () => {
    expect(nextVersion([])).toBe(1);
    expect(nextVersion([{ version: 1 }, { version: 3 }])).toBe(4);
    expect(isEditable("approved")).toBe(false);
    expect(isEditable("submitted")).toBe(false);
    expect(isEditable("draft")).toBe(true);
    expect(currentApproved([{ status: "superseded", version: 1 }, { status: "approved", version: 2 }])?.version).toBe(2);
  });
});

describe("export", () => {
  it("neutralizes formulas", () => {
    expect(escapeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCell('a,"b"')).toBe('"a,""b"""');
  });
});

import { currentHolder, termEnd, titleIndex, withTitle } from "./titles";
describe("board roles and titles", () => {
  const t = (o: Partial<{ id: string; position_id: string; position: string; person_name: string; user_id: string | null; start_date: string; end_date: string | null }>) =>
    ({ id: "x", position_id: "vp", position: "Membership VP", person_name: "Morgan", user_id: "u1", start_date: "2025-01-01", end_date: null, ...o });
  it("a 2-year term starting Jan 1 2026 ends Dec 31 2027", () => expect(termEnd("2026-01-01", 2)).toBe("2027-12-31"));
  it("a role with no fixed term has no end date", () => expect(termEnd("2026-01-01", null)).toBeNull());
  it("the new holder fills the role; the old term is history", () => {
    const terms = [t({ id: "old", person_name: "Pat", end_date: "2026-05-31" }), t({ id: "new", start_date: "2026-06-01" })];
    expect(currentHolder(terms, "vp", "2026-07-01")?.id).toBe("new");
    expect(currentHolder(terms, "vp", "2026-03-01")?.id).toBe("old");
  });
  it("names show with the current title", () => {
    const idx = titleIndex([t({})], "2026-01-01");
    expect(withTitle("Morgan", idx.title("u1"))).toBe("Morgan — Membership VP");
    expect(idx.title("u2")).toBeNull();
  });
});
