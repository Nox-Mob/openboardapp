import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform";
import { selectAdapter } from "./index";

describe("data layer platform check", () => {
  it("uses Supabase when its URL and key are configured", () => {
    expect(
      detectPlatform({ VITE_SUPABASE_URL: "https://x", VITE_SUPABASE_PUBLISHABLE_KEY: "k" }),
    ).toBe("supabase");
  });
  it("reports unconfigured when either setting is missing", () => {
    expect(detectPlatform({ VITE_SUPABASE_URL: "https://x" })).toBe("unconfigured");
    expect(detectPlatform({})).toBe("unconfigured");
  });
  it("refuses to run without a configured platform", () => {
    expect(() => selectAdapter("unconfigured")).toThrow(/No data platform/);
    expect(selectAdapter("supabase").platform).toBe("supabase");
  });
});
