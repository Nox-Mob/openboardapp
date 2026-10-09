// .env is tracked on purpose (Lovable needs it). It may only hold publishable values.
import { readFileSync, existsSync } from "node:fs";

if (!existsSync(".env")) {
  console.log(".env not present — nothing to check.");
  process.exit(0);
}
const allowed = new Set([
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
]);
const problems = [];
for (const [i, raw] of readFileSync(".env", "utf8").split(/\r?\n/).entries()) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [key, ...rest] = line.split("=");
  const value = rest.join("=").replace(/^["']|["']$/g, "");
  if (!allowed.has(key.trim())) problems.push(`line ${i + 1}: ${key} is not an allowed public key`);
  if (/sb_secret_|service_role|BEGIN [A-Z ]*PRIVATE KEY/i.test(value))
    problems.push(`line ${i + 1}: ${key} looks like a secret`);
}
if (problems.length) {
  for (const p of problems) console.log(`::error file=.env::${p}`);
  process.exit(1);
}
console.log(".env contains publishable values only.");
