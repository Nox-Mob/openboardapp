import { describe, expect, it } from "vitest";
import { HELP, helpHrefFor, helpKeyFor } from "./help";

describe("help links (S-04)", () => {
  it("every docs path is a section page or the app's home", () => {
    for (const path of Object.values(HELP)) expect(path).toMatch(/^board\/([a-z-]+\/[a-z-]+\/)?$/);
  });

  it("each page opens its own docs page", () => {
    expect(helpKeyFor("/board")).toBe("overview");
    expect(helpKeyFor("/board/meetings")).toBe("meetings");
    expect(helpKeyFor("/board/meetings/m1")).toBe("meetings");
    expect(helpKeyFor("/board/live/m1")).toBe("voting");
    expect(helpKeyFor("/board/members")).toBe("people");
    expect(helpKeyFor("/board/documents")).toBe("records");
    expect(helpKeyFor("/elsewhere")).toBe("home");
    expect(helpHrefFor("/board/live/m1")).toBe(
      "https://docs.openapphub.org/board/voting/motions-and-votes/",
    );
  });
});
