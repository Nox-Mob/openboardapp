import { describe, expect, it } from "vitest";
import { agendaRowsFor, agendaToText, normalizeAgenda, parseAgendaText, STANDARD_AGENDA, totalMinutes } from "./templates";

describe("meeting templates", () => {
  it("standard agenda keeps the six default items in order", () => {
    expect(STANDARD_AGENDA.map((a) => a.title)).toEqual(["Call to order", "Approval of previous minutes", "Treasurer's report", "Old business", "New business", "Adjournment"]);
  });
  it("blank and malformed agenda entries are dropped", () => {
    expect(normalizeAgenda([{ title: "  " }, null, 5, { title: " Budget " }])).toEqual([{ title: "Budget", presenter: null, duration_minutes: null, description: null, proposed_motion: null }]);
    expect(normalizeAgenda("nope")).toEqual([]);
  });
  it("invalid durations are cleared", () => {
    expect(normalizeAgenda([{ title: "A", duration_minutes: -5 }, { title: "B", duration_minutes: 9999 }, { title: "C", duration_minutes: 15 }]).map((a) => a.duration_minutes)).toEqual([null, null, 15]);
  });
  it("new meeting agenda rows are numbered from 0 and tied to the meeting and org", () => {
    const rows = agendaRowsFor([{ title: "One" }, { title: "Two" }], "m1", "o1");
    expect(rows.map((r) => [r.position, r.meeting_id, r.organization_id])).toEqual([[0, "m1", "o1"], [1, "m1", "o1"]]);
  });
  it("agenda text editor parses Title | Presenter | Minutes", () => {
    expect(parseAgendaText("Budget | Treasurer | 20\n\nAdjourn")).toEqual([
      { title: "Budget", presenter: "Treasurer", duration_minutes: 20, description: null, proposed_motion: null },
      { title: "Adjourn", presenter: null, duration_minutes: null, description: null, proposed_motion: null },
    ]);
  });
  it("text round-trips and totals minutes", () => {
    const items = parseAgendaText("Budget | Treasurer | 20\nReview | | 10");
    expect(parseAgendaText(agendaToText(items))).toEqual(items);
    expect(totalMinutes(items)).toBe(30);
  });
});
