import { describe, expect, it } from "vitest";
import { CAPABILITIES, READ_ONLY_SAFE, canNow, type Capability } from "./permissions";

// S-05: while billing makes Board read-only, write controls are off; reading, the audit log,
// exports and ownership stay on.
describe("canNow (role and read-only)", () => {
  const caps = Object.keys(CAPABILITIES) as Capability[];

  it("with full access it is exactly the role table", () => {
    for (const cap of caps) expect(canNow("owner", cap, false)).toBe(true);
    expect(canNow("observer", "records.edit", false)).toBe(false);
  });

  it("read-only turns every write off, even for the owner", () => {
    for (const cap of caps) expect(canNow("owner", cap, true)).toBe(READ_ONLY_SAFE.includes(cap));
    expect(canNow("owner", "records.edit", true)).toBe(false);
    expect(canNow("owner", "org.manage", true)).toBe(false);
  });

  it("reading and exporting stay on", () => {
    expect(canNow("observer", "records.read", true)).toBe(true);
    expect(canNow("admin", "export.run", true)).toBe(true);
    expect(canNow("secretary", "audit.read", true)).toBe(true);
  });

  it("read-only never grants what the role doesn't", () => {
    expect(canNow("member", "export.run", true)).toBe(false);
  });
});
