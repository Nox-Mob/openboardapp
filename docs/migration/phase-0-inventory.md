# Phase 0 inventory: moving OpenBoard off Lovable Cloud

Phase 0 goal: this repository can rebuild its whole database from scratch with the Supabase CLI, proven by the `replay` job in `.github/workflows/supabase-db.yml`, with no dependence on Lovable. No application behavior changes in this phase. Nothing is exported or restored: there are no real users, only demo and test data, and the new project is built from the migrations alone.

Written November 5, 2026, from `main` at `ed86c99` (Added docs/architecture.md).

## 1. Migrations

### Order Lovable applied them

Lovable Cloud applies the SQL files in `drizzle/migrations` through `LOVABLE_DB_MIGRATION_URL` (`drizzle.config.ts:8`). The order is `drizzle/migrations/meta/_journal.json`. `drizzle/schema.ts` is an empty stub: Drizzle is only the migration runner. `supabase/migrations` did not exist before Phase 0.

Each file was copied **byte for byte** into `supabase/migrations` (checked with `cmp`). The 14-digit timestamp is the journal's `when` value (milliseconds since 1970) converted to UTC, so the files sort in the original order.

| #   | Original (`drizzle/migrations/`)    | Journal `when` (UTC)     | Copy (`supabase/migrations/`)                 |
| --- | ----------------------------------- | ------------------------ | --------------------------------------------- |
| 0   | `0000_board_core_schema.sql`        | 2026-10-09T16:07:32.888Z | `20261009160732_board_core_schema.sql`        |
| 1   | `0001_meeting_templates.sql`        | 2026-10-09T16:32:52.827Z | `20261009163252_meeting_templates.sql`        |
| 2   | `0002_vote_recording.sql`           | 2026-10-09T16:50:46.628Z | `20261009165046_vote_recording.sql`           |
| 3   | `0003_live_voting.sql`              | 2026-10-09T18:34:55.405Z | `20261009183455_live_voting.sql`              |
| 4   | `0004_agenda_vote_items.sql`        | 2026-10-09T18:55:18.558Z | `20261009185518_agenda_vote_items.sql`        |
| 5   | `0005_board_positions.sql`          | 2026-10-09T19:10:34.099Z | `20261009191034_board_positions.sql`          |
| 6   | `0006_vote_recusal.sql`             | 2026-10-09T19:43:04.260Z | `20261009194304_vote_recusal.sql`             |
| 7   | `0007_organization_letterheads.sql` | 2026-10-09T20:35:08.714Z | `20261009203508_organization_letterheads.sql` |

New in Phase 0 (fixes go in new migrations, never in old ones):

| File                                 | Why                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `20261105000000_storage_buckets.sql` | Creates the private `org-files` bucket. Lovable created it outside the migrations (see "Storage" below). |

`drizzle/` and `drizzle.config.ts` stay in place and are marked legacy in the README. Lovable keeps deploying from them until the Phase 1 cutover, when they are removed. Until then, **a schema change must be added to both folders** with the same SQL, or the two histories drift.

### What the migrations create

**Extensions and schemas.** `pgcrypto` in schema `extensions` (0000; `gen_random_bytes` and `digest` for invitation tokens). No new schemas: everything is in `public`, plus policies on `storage.objects` and a trigger on `auth.users`.

**Enums** (all 0000): `org_role` (owner, admin, chair, secretary, treasurer, member, observer), `meeting_status`, `minutes_status`, `attendance_status`, `motion_outcome`, `task_status`.

**Tables** (22, all in `public`, all with RLS enabled and explicit GRANTs):

| Table                                                                                                                                                                         | Migration | RLS / GRANTs                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `profiles`, `organizations`, `memberships`, `invitations`, `audit_log`                                                                                                        | 0000      | Written out per table                                                                                  |
| `board_terms`, `committees`, `committee_members`, `meetings`, `agenda_items`, `attendance`, `motions`, `minutes`, `documents`, `document_versions`, `packets`, `action_items` | 0000      | **Inside a `foreach … execute format(…)` loop**: grants, `enable row level security` and four policies |
| `meeting_templates`                                                                                                                                                           | 0001      | Written out                                                                                            |
| `vote_electorate`, `member_votes`                                                                                                                                             | 0003      | Written out (select only for `authenticated`; writes only through RPCs)                                |
| `board_positions`                                                                                                                                                             | 0005      | Written out                                                                                            |
| `organization_letterheads`                                                                                                                                                    | 0007      | Written out                                                                                            |

Because twelve tables are secured inside a loop, grepping the SQL is not enough. The `replay` job checks the **catalog after replay** (`scripts/ci/check-rls-after-replay.sql`).

**Views:** none.

**Functions** (all `public`):

- RLS helpers (security definer): `is_org_member`, `has_org_role`, `can_edit_records`, `can_manage_org`, `shares_org_with`, `vote_is_closed`.
- RPCs (security definer, `execute` revoked from `anon` and granted to `authenticated`): `create_organization`, `create_invitation`, `accept_invitation`, `start_vote` (replaced in 0004), `cast_vote` (replaced in 0006), `close_vote`, `vote_progress`, `record_disposition`. `finish_vote` (replaced in 0006) is internal, and `execute` is revoked from everyone but the owner.
- Trigger functions: `handle_new_user`, `audit_row`, `check_meeting_org`, `check_committee_org`, `check_document_org`, `check_packet_path`, `check_motion_agenda_org`, `check_term_position_org`, `lock_approved_minutes`, `lock_meeting_records`, `lock_distributed_packets`, `reject_vote_change`, `protect_live_motion`.

**Triggers:**

- `auth.users`: `on_auth_user_created` → `handle_new_user` (creates the profile).
- Same-org checks: `t_org_agenda`, `t_org_att`, `t_org_mot`, `t_org_min`, `t_org_doc`, `t_org_pkt`, `t_org_act` (→ `check_meeting_org`); `t_org_cm`; `t_org_dv`; `t_pkt_path`; `t_mot_agenda`; `t_org_term_pos`.
- Locks: `t_lock_minutes`, `t_lock_motions`, `t_lock_attendance`, `t_lock_packets`, `t_live_motion`, `t_immutable` (on `member_votes` and `vote_electorate`).
- Audit: `t_audit` on 15 tables from the 0000 loop, plus `meeting_templates`, `board_positions`, `organization_letterheads`, and insert-only on `member_votes` and `vote_electorate`.

**Indexes:** `memberships(user_id)`, `meetings(organization_id, meeting_date)`, `agenda_items(meeting_id, position)`, `action_items(organization_id, assignee_id)`, `audit_log(organization_id, created_at desc)`, `meeting_templates_org_idx`, `motions_one_open_vote` (partial unique), `board_terms_position_idx`.

**Storage policies** on `storage.objects`: `org members read files` (select, 0000), `org editors upload files` (insert, 0000), `letterhead uploads require managers` (restrictive insert, 0007). There are no update or delete policies, so users cannot overwrite or delete stored files.

**Checked against the live Lovable schema.** `src/integrations/supabase/types.ts` was generated from the Lovable database. After replay, the local database has the same 22 tables with **identical columns**, every RPC in `types.ts`, and the same enums. The storage bucket is the only object Lovable created by hand.

## 2. Storage buckets

| Bucket      | Used in                                                                                                                         | Public?     | Evidence                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `org-files` | `src/data/cloud-adapter.ts:10` (`BUCKET`), uploads at :128, :417, :436; `createSignedUrl(path, 60)` at :451; `download` at :455 | **Private** | No `getPublicUrl` anywhere in the code; downloads use 60-second signed URLs or authenticated downloads; storage policies restrict reads to org members (`is_org_member` on the first path folder) |

Paths start with the organization id. Letterheads use `<org>/letterhead/…`, enforced by a check on `organization_letterheads.storage_path` and the restrictive upload policy. The bucket is created in `20261105000000_storage_buckets.sql` (`public = false`, `on conflict (id) do nothing`) and in `[storage.buckets.org-files]` in `supabase/config.toml` for the local stack. Lovable never set a file size limit or MIME list in code, so none is set here. The local stack's global limit is 50 MiB.

## 3. Dependencies on Lovable Cloud (list only; Phase 1 changes them)

| What                                                  | Where                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lovable.dev/cloud-auth-js` (Google OAuth broker)    | `package.json:24`; `src/integrations/lovable/index.ts:3-4` (`createLovableAuth`, line 6; `signInWithOAuth`, line 16)                                                                                                                                                       |
| Lovable OAuth used for Google sign-in                 | `src/data/cloud-adapter.ts:2` (import), `:65` (`lovable.auth.signInWithOAuth("google", …)`); called from `src/routes/auth.tsx:78`                                                                                                                                          |
| `@lovable.dev/vite-tanstack-config` (build)           | `package.json:82`; `vite.config.ts:1,7` (also sets dev port 8080 and a Cloudflare nitro target)                                                                                                                                                                            |
| `src/integrations/lovable/`                           | `src/integrations/lovable/index.ts` (whole file, auto-generated)                                                                                                                                                                                                           |
| `LOVABLE_DB_MIGRATION_URL`                            | `drizzle.config.ts:8`                                                                                                                                                                                                                                                      |
| `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS` | `src/integrations/supabase/cron-auth.ts:3-4` (auto-generated helper; **not called anywhere** in `src/`)                                                                                                                                                                    |
| Lovable preview auth storage                          | `src/integrations/supabase/previewAuthStorage.ts:8,22-30,65-90` (brokers sessions inside `lovableproject.com` / `lovable.app` previews); used by `src/integrations/supabase/client.ts`                                                                                     |
| Lovable editor error reporting                        | `src/lib/lovable-error-reporting.ts:18-46` (`window.__lovableEvents`, `__lovableReportRuntimeError`); `src/routes/__root.tsx:14,44`                                                                                                                                        |
| "Connect Supabase in Lovable Cloud" messages          | `src/integrations/supabase/client.ts:69`, `auth-middleware.ts:44`, `client.server.ts:44`                                                                                                                                                                                   |
| Platform name `lovable-cloud`                         | `src/data/platform.ts:6,14`; `src/data/index.ts:13`; `src/data/cloud-adapter.ts:39,41`; `src/data/data-layer.test.ts:8,11,19`                                                                                                                                              |
| Lovable-hosted backend in `.env`                      | `.env` (tracked): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` and `VITE_` copies point at Lovable project `mgfijwkqnvmhuzykpfcz`. **The Supabase CLI also reads `SUPABASE_PROJECT_ID` from `.env`**, so CI moves `.env` aside before running the CLI |
| Old `supabase/config.toml`                            | Held only `project_id = "mgfijwkqnvmhuzykpfcz"` (the Lovable project ref). Now `openboardapp`                                                                                                                                                                              |
| Lovable npm cache in the lockfile                     | `package-lock.json`: 84 `resolved` URLs point at `europe-west1-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/…` (first at line 400). GitHub runners can download them today; Phase 1 should regenerate the lockfile against `registry.npmjs.org`                         |
| Lovable project files                                 | `.lovable/project.json`, `.lovable/plan/*`; README "Build with Lovable" section; `AGENTS.md` banner                                                                                                                                                                        |
| `ai.gateway.lovable.dev`                              | **Not used** (no AI calls in the code)                                                                                                                                                                                                                                     |
| Live DB tests target the Lovable backend              | `src/test/db/helpers.ts:18-19` read `VITE_SUPABASE_URL` / key (from `.env` by default); `ci.yml` job `database-rules` runs them against Lovable                                                                                                                            |

## 4. Database tests and checks

| What                                           | Runs                                                                                                                                                      | How to run                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/ci/check-migrations.mjs`              | Static: every table created in `drizzle/migrations` enables RLS and has a policy (loop-aware); official-record tables never dropped                       | `node scripts/ci/check-migrations.mjs`                                                                                                    |
| `scripts/ci/check-env.mjs`                     | `.env` holds publishable keys only                                                                                                                        | `node scripts/ci/check-env.mjs`                                                                                                           |
| `src/test/db/*.test.ts` (6 files, 79 tests)    | Live rules: tenant isolation, roles, invitations, official-record locks, audit, live voting, templates, letterhead (including storage)                    | Against Lovable: `npm test -- src/test/db`. Against a rebuilt local DB: see the `replay` job                                              |
| `scripts/db-test.sh`, `supabase/tests` (pgTAP) | **Do not exist**, so `supabase test db` is not part of `replay`                                                                                           | n/a                                                                                                                                       |
| New: `scripts/ci/check-rls-after-replay.sql`   | After replay: every `public` table has RLS enabled and a SELECT/INSERT/UPDATE/DELETE grant to `authenticated` or `service_role`; names each failing table | `psql "$DB_URL" -f scripts/ci/check-rls-after-replay.sql`                                                                                 |
| New: `scripts/ci/db-test-fixtures.sql`         | CI-only: creates `test-a`, `test-member`, `test-b` accounts and Test Org A/B on the **local** database                                                    | `psql "$DB_URL" -f scripts/ci/db-test-fixtures.sql` (never on a cloud project)                                                            |
| New: `scripts/ci/vitest.db.config.mjs`         | Runs `src/test/db` in Node (no jsdom), one file at a time                                                                                                 | `npx vitest run --config scripts/ci/vitest.db.config.mjs` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` set to the local stack |

The `replay` job runs, in order: `supabase start` (database, auth, REST, storage, gateway only), `supabase db reset`, `supabase db lint --level error --fail-on error`, the RLS/GRANT check, `check-migrations.mjs`, the fixtures, and then the 79 live-rule tests against the rebuilt database. Before running the tests it refuses any URL that is not `127.0.0.1`/`localhost`.

Locally (anywhere with Docker and the Supabase CLI 3.0.0):

```sh
mv .env .env.lovable-cloud   # stop the CLI and tests from picking up the Lovable project
supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
supabase db reset
supabase db lint --level error --fail-on error
psql "$(supabase status -o json | jq -r .DB_URL)" -f scripts/ci/check-rls-after-replay.sql
psql "$(supabase status -o json | jq -r .DB_URL)" -f scripts/ci/db-test-fixtures.sql
eval "$(supabase status -o json | jq -r '"export VITE_SUPABASE_URL=\(.API_URL) VITE_SUPABASE_PUBLISHABLE_KEY=\(.PUBLISHABLE_KEY)"')"
npx vitest run --config scripts/ci/vitest.db.config.mjs
mv .env.lovable-cloud .env
```

## 5. Fixes made while making `replay` green

The migrations were first replayed in a Docker-enabled cloud session with CLI 3.0.0, then in GitHub Actions. No migration SQL needed a fix: the history applies cleanly to an empty database, and lint reports no errors.

| Problem found                                                                                                                                                                                                                                                                                          | Fix                                                                                                                                      | Why                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `org-files` bucket is in no migration: storage policies existed, but uploads would fail on a new project                                                                                                                                                                                           | New migration `20261105000000_storage_buckets.sql`, plus `[storage.buckets.org-files]` in `config.toml`                                  | Lovable created the bucket by hand                                                                                                                                                                                                                                                                         |
| The local stack exposes new tables automatically by default; the new cloud project does not                                                                                                                                                                                                            | `api.auto_expose_new_tables = false` in `config.toml`                                                                                    | So a missing GRANT fails in CI just as it would on the cloud project. After replay, `postgres`'s default privileges give the API roles no SELECT/INSERT/UPDATE/DELETE, and every table still passes on its explicit grants. Functions keep the built-in PUBLIC `execute`, so the RLS helpers stay callable |
| The CLI picked up `SUPABASE_PROJECT_ID` (the Lovable ref) from the tracked `.env`, and the tests would read the Lovable URL from it                                                                                                                                                                    | Both jobs move `.env` aside first; the test step refuses any non-local URL                                                               | Keeps CI fully independent of Lovable                                                                                                                                                                                                                                                                      |
| The live-rule tests sign in as accounts that exist only on Lovable                                                                                                                                                                                                                                     | `scripts/ci/db-test-fixtures.sql` creates them, with Test Org A/B only, on the local database                                            | AGENTS.md: test accounts belong only to Test Org A/B                                                                                                                                                                                                                                                       |
| `letterhead.test.ts` › "members cannot upload letterhead bytes" hung for 30 s under jsdom against the local HTTP API (the request reached the gateway only when the client gave up). A direct upload as the member returned `403 new row violates row-level security policy`, so the rule itself works | `scripts/ci/vitest.db.config.mjs` runs the DB suites in vitest's `node` environment without the DOM setup file. Test files are unchanged | jsdom's `Blob` is not streamed by Node's `fetch`; the DB suites don't need a DOM                                                                                                                                                                                                                           |
| CLI 3 changed `db push` to target the **local** database by default                                                                                                                                                                                                                                    | `deploy` runs `supabase db push --remote --yes`                                                                                          | A bare `supabase db push` would silently do nothing to the cloud project                                                                                                                                                                                                                                   |

## 6. Notes for Phase 1

- Keep `drizzle/migrations` and `supabase/migrations` identical until cutover, then delete `drizzle/`, `drizzle.config.ts`, the `drizzle-*` dev dependencies, and point `check-migrations.mjs` at `supabase/migrations`.
- Do not merge this branch into `main` before cutover. `main` syncs to Lovable, and `supabase/config.toml` (project id) and `supabase/migrations` are files Lovable tooling may read.
- `ci.yml`'s `database-rules` job still tests against the Lovable backend; retarget it to the new project, or drop it in favor of `replay`.
- The CI `Dependency vulnerabilities` job was already failing before Phase 0 (run 41976135349). Phase 0 does not change dependencies.
