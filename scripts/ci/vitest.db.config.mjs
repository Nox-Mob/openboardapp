// Vitest config for the live database suites (src/test/db/*) when they run against
// the local stack rebuilt by .github/workflows/supabase-db.yml.
// They need no DOM, so they run in Node: jsdom's Blob is not streamed by Node's
// fetch, which leaves storage uploads in letterhead.test.ts hanging against a
// plain-HTTP local API. The suites themselves are unchanged.
import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["src/test/db/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // The suites share Test Org A; run files one at a time like a single client would.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(root, "src") },
  },
});
