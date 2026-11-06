import { describe, expect, it } from "vitest";
import { confirmationMatches } from "./ownership";

describe("ownership transfer confirmation", () => {
  it("accepts the exact name, ignoring case and surrounding spaces", () => {
    expect(confirmationMatches("Jane Doe", "Jane Doe")).toBe(true);
    expect(confirmationMatches("  jane doe ", "Jane Doe")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(confirmationMatches("", "Jane Doe")).toBe(false);
    expect(confirmationMatches("Jane", "Jane Doe")).toBe(false);
    expect(confirmationMatches("Jane  Doe", "Jane Doe")).toBe(false);
    expect(confirmationMatches("TRANSFER OWNERSHIP", "Jane Doe")).toBe(false);
  });
  it("never matches an empty expected name", () => {
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("  ", " ")).toBe(false);
  });
});
