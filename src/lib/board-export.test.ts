import { describe, expect, it } from "vitest";
import { folderNames, packetAsOf, rangeError, tookPlace, versionAsOf, yearToDate } from "./board-export";

describe("board record export", () => {
  it("defaults to year to date", () => {
    expect(yearToDate(new Date("2026-10-09T12:00:00Z"))).toEqual({ from: "2026-01-01", to: "2026-10-09" });
  });
  it("allows up to one year and no more", () => {
    expect(rangeError("2025-10-10", "2026-10-09")).toBeNull();
    expect(rangeError("2025-10-08", "2026-10-09")).toMatch(/one year/);
    expect(rangeError("2026-05-01", "2026-04-01")).toMatch(/before/);
  });
  it("includes only meetings that took place", () => {
    expect(["draft", "scheduled", "in_progress", "completed", "archived"].filter(tookPlace)).toEqual(["in_progress", "completed", "archived"]);
  });
  it("uses the packet as it stood on the meeting day", () => {
    const packets = [
      { version: 1, created_at: "2026-09-01T10:00:00Z", distributed_at: "2026-09-02T10:00:00Z" },
      { version: 2, created_at: "2026-09-10T10:00:00Z", distributed_at: null },
      { version: 3, created_at: "2026-09-20T10:00:00Z", distributed_at: "2026-09-20T11:00:00Z" },
    ];
    expect(packetAsOf(packets, "2026-09-14")?.version).toBe(1);
    expect(packetAsOf(packets, "2026-08-01")).toBeUndefined();
    expect(versionAsOf([{ version: 1, created_at: "2026-09-01T00:00:00Z" }, { version: 2, created_at: "2026-09-15T00:00:00Z" }], "2026-09-14")?.version).toBe(1);
  });
  it("gives each meeting its own folder", () => {
    expect(folderNames([{ meeting_date: "2026-09-14", title: "Board / budget" }, { meeting_date: "2026-09-14", title: "Board / budget" }])).toEqual(["2026-09-14 Board - budget", "2026-09-14 Board - budget (2)"]);
  });
});
