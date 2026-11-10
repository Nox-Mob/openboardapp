// Static migration checks (spec §3.3, §3.4) on db/migrations, the only migration path:
// - file names are NNNN_name.sql, numbered without gaps or duplicates;
// - every table a migration creates enables row level security and gets a policy;
// - official-record tables are never dropped;
// - migrations only create objects in schemas Board owns (board, and storage policies).
// The migration runner (scripts/migrate.mjs) refuses edited files at apply time.
import { readFileSync, readdirSync } from "node:fs";

const dir = "db/migrations";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const problems = [];

files.forEach((f, i) => {
  const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) problems.push(`${f}: name must be NNNN_<name>.sql`);
  else if (Number(m[1]) !== i + 1)
    problems.push(`${f}: expected number ${String(i + 1).padStart(4, "0")}`);
});

const sql = files
  .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
  .join("\n")
  .replace(/--[^\n]*/g, "")
  .toLowerCase();

const tables = new Set();
for (const m of sql.matchAll(
  /create table (?:if not exists )?([a-z_]+)\.([a-z_][a-z0-9_]*)\s*\(/g,
)) {
  if (m[1] !== "board") problems.push(`${m[1]}.${m[2]}: tables must be in schema board`);
  tables.add(m[2]);
}

// Tables secured in a `foreach t in array array[...] loop ... execute format(...)` block.
const loopSecured = { rls: new Set(), policy: new Set() };
for (const m of sql.matchAll(/foreach \w+ in array array\[([^\]]+)\] loop([\s\S]*?)end loop/g)) {
  const names = [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
  for (const n of names) {
    if (/enable row level security/.test(m[2])) loopSecured.rls.add(n);
    if (/create policy/.test(m[2])) loopSecured.policy.add(n);
  }
}
for (const t of tables) {
  const q = `board\\.${t}`;
  if (
    !loopSecured.rls.has(t) &&
    !new RegExp(`alter table (?:only )?${q}\\s+enable row level security`).test(sql)
  )
    problems.push(`board.${t}: row level security is never enabled`);
  if (!loopSecured.policy.has(t) && !new RegExp(`create policy [^;]*? on ${q}[\\s;]`).test(sql))
    problems.push(`board.${t}: has no policies (locked for everyone)`);
}
for (const t of ["audit_log", "member_votes", "vote_electorate", "minutes"]) {
  if (new RegExp(`drop table (?:if exists )?board\\.${t}\\b`).test(sql))
    problems.push(`board.${t}: an official-record table is dropped`);
}
for (const m of sql.matchAll(
  /create (?:or replace )?(?:function|view|type|trigger \w+ \w+ \w+ (?:or \w+ )*on) ([a-z_]+)\./g,
)) {
  if (!["board", "storage"].includes(m[1]))
    problems.push(`objects in schema ${m[1]}: Board only writes to board`);
}

if (problems.length) {
  for (const p of problems) console.log(`::error file=${dir}::${p}`);
  process.exit(1);
}
console.log(
  `Checked ${files.length} migrations, ${tables.size} tables in board: RLS and policies present.`,
);
