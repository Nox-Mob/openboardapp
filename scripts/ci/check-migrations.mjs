// Static migration checks: every public table created in drizzle/migrations must
// enable row level security and get at least one policy, so no table ships unlocked
// or unreachable. Also flags destructive statements on official-record tables.
import { readFileSync, readdirSync } from "node:fs";

const dir = "drizzle/migrations";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const sql = files
  .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
  .join("\n")
  .toLowerCase();

const tables = new Set();
for (const m of sql.matchAll(
  /create table (?:if not exists )?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/g,
))
  tables.add(m[1]);

// Tables secured in a `foreach t in array array[...] loop ... execute format(...)` block.
const loopSecured = { rls: new Set(), policy: new Set() };
for (const m of sql.matchAll(/foreach \w+ in array array\[([^\]]+)\] loop([\s\S]*?)end loop/g)) {
  const names = [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
  for (const n of names) {
    if (/enable row level security/.test(m[2])) loopSecured.rls.add(n);
    if (/create policy/.test(m[2])) loopSecured.policy.add(n);
  }
}

const problems = [];
const prefix = (t) => `(?:public\\.)?"?${t}"?`;
for (const t of tables) {
  if (!loopSecured.rls.has(t) && !new RegExp(`alter table (?:only )?${prefix(t)}\\s+enable row level security`).test(sql))
    problems.push(`${t}: row level security is never enabled`);
  if (!loopSecured.policy.has(t) && !new RegExp(`create policy [^;]*? on ${prefix(t)}[\\s;]`).test(sql))
    problems.push(`${t}: has no policies (locked for everyone)`);
}
const protectedTables = ["audit_log", "member_votes", "vote_electorate"];
for (const t of protectedTables) {
  if (new RegExp(`drop table (?:if exists )?${prefix(t)}`).test(sql))
    problems.push(`${t}: an official-record table is dropped`);
}
// Every migration file name must be numbered and unique.
const nums = files.map((f) => f.slice(0, 4));
if (new Set(nums).size !== nums.length) problems.push("two migrations share the same number");

if (problems.length) {
  for (const p of problems) console.log(`::error file=${dir}::${p}`);
  process.exit(1);
}
console.log(`Checked ${files.length} migrations, ${tables.size} tables: RLS and policies present.`);
