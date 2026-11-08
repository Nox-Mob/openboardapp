# Suite migration notes: OpenBoardApp → shared OpenAppHub project

This file is step 1 of the work order in `AGENTS.md` (Phase 1, "Inventory PR"). It lists everything Board has in its own Supabase project today, how each piece maps onto the suite's shared core (`docs/SHARED-SPEC.md` §3), every place the code calls Supabase, and the decisions the owner needs to make before Phase 2. Later steps update the **Progress** table at the end.

Written November 8, 2026, from `main` at `361780b`. Sources: `supabase/migrations/` (11 files), `src/integrations/supabase/types.ts`, `src/data/cloud-adapter.ts`, and `docs/migration/phase-0-inventory.md`. Phase 0 already proved that the migrations rebuild the live schema with identical columns (`replay` job), so no schema dump is needed from the owner.

Target: Board's tables move to schema **`board`** in the shared production project (today's OpenCharterApp project). Board's own project (`dnsqxiiexkdokgebysrt`) is wiped afterwards and reused as staging. Nothing in it is kept except demo content, which is rewritten as seed SQL.

## 1. What Board's database contains today

Everything is in schema `public`, plus policies on `storage.objects`, a trigger on `auth.users`, and one `pg_cron` job.

### 1.1 Extensions

| Extension  | Schema       | Used for                                                           | Shared project                                                        |
| ---------- | ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `pgcrypto` | `extensions` | `gen_random_bytes`, `digest` (invitation tokens)                   | Enabled by default on Supabase. Keep `create extension if not exists` |
| `pg_cron`  | `pg_catalog` | `reset-demo-org` job every 6 hours (`20261106010000_demo_org.sql`) | **Do not bring to production.** See §6 (demo)                         |

### 1.2 Enums

| Enum                | Values                                                      | Maps to                                                                                          |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `org_role`          | owner, admin, chair, secretary, treasurer, member, observer | **Clashes with core `public.org_role`** (owner, admin, member, viewer). See §2.2 and decision D1 |
| `meeting_status`    | draft, scheduled, in_progress, completed, archived          | `board.meeting_status`                                                                           |
| `minutes_status`    | draft, submitted, approved, superseded                      | `board.minutes_status`                                                                           |
| `attendance_status` | present, absent, excused, remote                            | `board.attendance_status`                                                                        |
| `motion_outcome`    | pending, carried, failed, tabled, withdrawn                 | `board.motion_outcome`                                                                           |
| `task_status`       | open, in_progress, done, cancelled                          | `board.task_status`                                                                              |

### 1.3 Tables (22)

"Org column" is `organization_id` everywhere today; the suite uses `org_id` (§3.4).

| Table                      | Created in             | Purpose                                                   | Suite destination                                                                              |
| -------------------------- | ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `profiles`                 | 0000                   | `id`, `full_name`, `email`                                | **Core** `public.profiles` (`display_name`, `avatar_url`; no `email`). See D3                  |
| `organizations`            | 0000, 0002, 0003       | name + Board settings (timezone, quorum, vote rules)      | **Core** `public.organizations` for id/name; Board columns move to `board.org_settings` (§2.1) |
| `memberships`              | 0000, ownership        | `id` pk, `organization_id`, `user_id`, `role`             | **Core** `public.memberships` (pk `(org_id, user_id)`, no `id`). See D1, D2                    |
| `invitations`              | 0000                   | token-hash invites                                        | Hosted: hub. Self-hosted: `board.invitations`. See D4                                          |
| `audit_log`                | 0000                   | trigger-written history                                   | `board.audit_log`                                                                              |
| `board_positions`          | 0005                   | roles (President, Secretary…) with term length            | `board.positions`                                                                              |
| `board_terms`              | 0000, 0005             | holder history: `person_name`, `user_id`, `position_id`   | `board.terms`, holder = user **or** `board.people` row (§2.3)                                  |
| `committees`               | 0000                   | committees                                                | `board.committees`                                                                             |
| `committee_members`        | 0000                   | `person_name`, `user_id`, `role`                          | `board.committee_members`, holder = user or `board.people`                                     |
| `meetings`                 | 0000                   | meetings                                                  | `board.meetings`                                                                               |
| `agenda_items`             | 0000, 0003, 0004       | agenda, notes, vote items with optional decision rule     | `board.agenda_items`                                                                           |
| `attendance`               | 0000                   | `person_name`, `user_id`, status, `is_voting`             | `board.attendance`, attendee = user or `board.people`                                          |
| `motions`                  | 0000, 0002, 0003, 0006 | motions, tallies, live-vote state, `vote_record` snapshot | `board.motions` (+ optional cross-app links, §4)                                               |
| `minutes`                  | 0000                   | versioned minutes, approval                               | `board.minutes`                                                                                |
| `documents`                | 0000                   | document metadata, category                               | `board.documents` (+ optional Charter link, §4)                                                |
| `document_versions`        | 0000                   | file versions in storage                                  | `board.document_versions`                                                                      |
| `packets`                  | 0000                   | generated board packets                                   | `board.packets`                                                                                |
| `action_items`             | 0000                   | tasks, `assignee_id` (user)                               | `board.action_items`, `assignee_id → auth.users`                                               |
| `meeting_templates`        | 0001                   | agenda outline as JSON                                    | `board.meeting_templates`                                                                      |
| `vote_electorate`          | 0003                   | frozen electorate per live vote (immutable)               | `board.vote_electorate`                                                                        |
| `member_votes`             | 0003, 0006             | individual votes incl. `recused` (immutable)              | `board.member_votes`                                                                           |
| `organization_letterheads` | 0007                   | active letterhead file, header/footer space               | `board.letterheads`                                                                            |

Final table names are proposed here and settled in the baseline PR (step 5); renames will be listed there with the code changes they need.

**Views:** none.

### 1.4 Functions

| Function                                                                                                                                    | Kind                       | Suite destination                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_org_member(_org)`                                                                                                                       | RLS helper                 | **Core** `public.is_member`                                                                                                                  |
| `has_org_role(_org, _roles)`                                                                                                                | RLS helper                 | **Core** `public.has_role` (4 core roles only)                                                                                               |
| `can_manage_org(_org)`                                                                                                                      | RLS helper                 | **Core** `public.has_role(org, '{owner,admin}')`                                                                                             |
| `can_edit_records(_org)`                                                                                                                    | RLS helper                 | `board.can_edit_records(org)` = `public.can_write(org,'board')` **and** Board officer check (D1)                                             |
| `shares_org_with(_user)`                                                                                                                    | RLS helper                 | Covered by core `profiles` select policy. Drop                                                                                               |
| `vote_is_closed(_motion)`                                                                                                                   | RLS helper                 | `board.vote_is_closed`                                                                                                                       |
| `create_organization(_name, _timezone)`                                                                                                     | RPC                        | **Core** `public.create_organization(p_name)`. Timezone moves to a `board.org_settings` insert done by Board on first use (lazy default row) |
| `create_invitation`, `accept_invitation`                                                                                                    | RPC                        | Hosted: hub. Self-hosted: `board.*` (D4)                                                                                                     |
| `ownership_transfer_candidates`, `transfer_ownership`                                                                                       | RPC                        | **Core concern** (writes `public.memberships`). Ask the hub to own it (D2); Board keeps the UI for self-hosted                               |
| `start_vote`, `cast_vote`, `close_vote`, `vote_progress`, `record_disposition`, `finish_vote`                                               | Live-voting RPCs (definer) | `board.*`; each must also require `public.can_write(org,'board')` so voting stops when read-only                                             |
| `handle_new_user`                                                                                                                           | trigger on `auth.users`    | **Core** (0002 recreates `on_auth_user_created`). Board's copies `full_name`; core must too (D3)                                             |
| `audit_row`                                                                                                                                 | trigger                    | `board.audit_row` on Board tables only. Board can no longer audit `organizations`/`memberships`/`invitations` (they live in `public`, §7 C4) |
| `check_meeting_org`, `check_committee_org`, `check_document_org`, `check_packet_path`, `check_motion_agenda_org`, `check_term_position_org` | same-org triggers          | `board.*`                                                                                                                                    |
| `lock_approved_minutes`, `lock_meeting_records`, `lock_distributed_packets`, `reject_vote_change`, `protect_live_motion`                    | record locks               | `board.*`, unchanged behaviour                                                                                                               |
| `reset_demo()`                                                                                                                              | demo builder               | **Not in production.** Replaced by `db/seed/0001_board_demo.sql` (staging only)                                                              |

### 1.5 Triggers

- `auth.users`: `on_auth_user_created` → `handle_new_user`. Core-owned after the move.
- Same-org: `t_org_agenda`, `t_org_att`, `t_org_mot`, `t_org_min`, `t_org_doc`, `t_org_pkt`, `t_org_act`, `t_org_cm`, `t_org_dv`, `t_pkt_path`, `t_mot_agenda`, `t_org_term_pos`.
- Locks: `t_lock_minutes`, `t_lock_motions`, `t_lock_attendance`, `t_lock_packets`, `t_live_motion`, `t_immutable` (×2).
- Audit: `t_audit` on 15 tables from the 0000 loop (including `organizations`, `memberships`, `invitations`), plus `meeting_templates`, `board_positions`, `organization_letterheads`, and insert-only on `member_votes` and `vote_electorate`.

### 1.6 Indexes and constraints worth keeping

`memberships_one_owner` (partial unique: one owner per org, **public table — see D2**), `motions_one_open_vote`, `meeting_templates (organization_id, name)` unique, `board_positions (organization_id, title)` unique, `minutes (meeting_id, version)`, `packets (meeting_id, version)`, `document_versions (document_id, version)`, the letterhead path check, and the vote-setting checks on `organizations` (`org_vote_close_modes_chk`, `org_vote_timer_chk`, `org_decision_rule_chk`), which move with the columns to `board.org_settings`.

### 1.7 Storage

| Bucket      | Public? | Paths                                             | Policies today                                                                                                              | Shared project                                                                                                                                                                                                                                         |
| ----------- | ------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `org-files` | No      | `<org id>/…`, letterheads `<org id>/letterhead/…` | select: `is_org_member`; insert: `can_edit_records`; restrictive insert for letterheads: `can_manage_org`. No update/delete | Rename to **`board-files`** so it cannot collide with Charter's or Ledger's buckets in one project. Same org-id prefix; select `public.is_member`, insert `board.can_edit_records` / manager check. Old project files are demo only and are not copied |

### 1.8 Edge Functions, cron, realtime

- Edge Functions: **none** (`[edge_runtime] enabled = false`).
- Cron: `reset-demo-org` (pg_cron, every 6 hours). Not carried to production.
- Realtime: not used (the live meeting dashboard polls).
- `src/integrations/supabase/cron-auth.ts` (Lovable cron secret helper) is unused; removed in step 3.

## 2. Mapping onto core

### 2.1 Organizations

Core `public.organizations` has `id, name, slug, created_by, created_at`. Board's extra columns become one row per org in `board.org_settings (org_id pk → public.organizations)`:

`timezone`, `quorum_count`, `vote_recording`, `vote_close_modes`, `vote_timer_minutes`, `vote_closer_roles`, `seconder_required`, `decision_rule`.

Org rename stays a core write (hosted: hub screen; self-hosted: Board's Settings writes `public.organizations.name`, allowed by the core update policy for owner/admin). Board's settings form writes `board.org_settings`. Missing rows read as the current defaults, so orgs created in the hub need no Board-side setup.

Core limits names to 120 characters; Board allowed 160. The UI limit drops to 120.

### 2.2 Roles

| Board role (today)      | Can today                                 | Proposed core role | Proposed Board-only marker |
| ----------------------- | ----------------------------------------- | ------------------ | -------------------------- |
| owner                   | everything, transfer ownership            | `owner`            | —                          |
| admin                   | manage org, invite, edit records, export  | `admin`            | —                          |
| chair                   | edit records, approve minutes, read audit | `member`           | officer = `chair`          |
| secretary               | edit records, approve minutes, read audit | `member`           | officer = `secretary`      |
| treasurer               | read only                                 | `member`           | officer = `treasurer`      |
| member ("Board member") | read only (and update own tasks, vote)    | `member`           | none                       |
| observer                | read only                                 | `viewer`           | —                          |

The catch: core `can_write` lets **every** `member` write, while Board today lets only owner/admin/chair/secretary edit records. Keeping today's behaviour needs a Board-side marker, e.g. `board.officers (org_id, user_id, office board.office)` managed by owner/admin, and `board.can_edit_records(org) = public.can_write(org,'board') and (public.has_role(org,'{owner,admin}') or office in ('chair','secretary'))`. `vote_closer_roles` would then hold Board offices plus core roles. **Decision D1.**

`src/lib/permissions.ts`, `src/lib/board.test.ts` and the `board/people/roles.md` docs page change with it.

### 2.3 People: users vs. non-users

`board_terms`, `committee_members`, `attendance`, `vote_electorate` and `member_votes` store `person_name` plus an optional, unconstrained `user_id`. Per the work order:

- `user_id uuid references auth.users(id) on delete set null` where the person signs in;
- new `board.people (id, org_id, full_name, email, notes)` for people without an account (external directors, guests);
- each holder table gets `user_id` **or** `person_id` (check: exactly one), and keeps `person_name` as a snapshot for official records (minutes and vote records must not change when someone renames their profile).

`vote_electorate` and `member_votes` stay user-only (only signed-in members vote).

### 2.4 Profiles

Board reads `profiles.full_name` and `profiles.email` for the members list and ownership transfer. Core `profiles` has `display_name` and no email. **Decision D3.**

## 3. Every place the code calls Supabase

The data layer rule (`AGENTS.md`, `src/data/data-layer.test.ts`) keeps nearly all calls in one file.

| File                                                | What                                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/integrations/supabase/client.ts`               | `createClient` (supabase-js, not `@supabase/ssr`) with Lovable `previewAuthStorage` (line 74–79). Replaced by `shared/supabase/client.ts` in step 9 |
| `src/integrations/supabase/client.server.ts`        | Service-role admin client. **Imported nowhere**; remove in step 3                                                                                   |
| `src/integrations/supabase/auth-middleware.ts`      | Server function middleware: `auth.getClaims(token)` (line 88)                                                                                       |
| `src/integrations/supabase/auth-attacher.ts`        | Attaches `auth.getSession()` bearer token to server-function calls (used by `src/start.ts:4`)                                                       |
| `src/routes/_authenticated/route.tsx:7`             | `auth.getUser()` route guard → hosted mode redirects to `${VITE_HUB_URL}/login?next=…` (step 11)                                                    |
| `src/data/cloud-adapter.ts` — auth (44–72)          | `getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signInWithOAuth` (Google), `signOut`                                            |
| `src/data/cloud-adapter.ts` — org (78–115)          | `memberships` select, `create_organization`, `organizations` update, `ownership_transfer_candidates`, `transfer_ownership`                          |
| `src/data/cloud-adapter.ts` — export (117–130)      | Loops `EXPORT_TABLES` (line 16) selecting `*` by `organization_id` (or `id` for `organizations`)                                                    |
| `src/data/cloud-adapter.ts` — letterhead (133–160)  | `organization_letterheads` select/upsert/delete, storage upload                                                                                     |
| `src/data/cloud-adapter.ts` — members (165–217)     | `memberships` select/update/delete **by `id`**, `profiles` select, `invitations` select/delete, `create_invitation`, `accept_invitation`            |
| `src/data/cloud-adapter.ts` — governance (222–299)  | `board_terms`, `board_positions`, `committees`, `committee_members`                                                                                 |
| `src/data/cloud-adapter.ts` — meetings (304–414)    | `meetings`, `agenda_items`, `attendance`, `motions`, `minutes`                                                                                      |
| `src/data/cloud-adapter.ts` — files (419–476)       | `documents`, `document_versions`, `packets`; storage `upload`, `createSignedUrl(path, 60)`, `download` on `org-files`                               |
| `src/data/cloud-adapter.ts` — dashboard (481–550)   | `meetings`, `documents`, `action_items`, `minutes`                                                                                                  |
| `src/data/cloud-adapter.ts` — audit (560)           | `audit_log`                                                                                                                                         |
| `src/data/cloud-adapter.ts` — live voting (580–640) | `start_vote`, `cast_vote`, `close_vote`, `record_disposition`, `vote_progress`; `vote_electorate`, `member_votes` selects                           |
| `src/data/cloud-adapter.ts` — templates (645–676)   | `meeting_templates`                                                                                                                                 |
| `src/data/platform.ts:14`                           | Platform detection names the backend `lovable-cloud` (rename in step 3)                                                                             |
| `src/lib/org-context.tsx:36`                        | Current org in `localStorage`. Replaced by the `oah_org` cookie via `shared/supabase/org.ts` (step 10)                                              |
| `src/test/db/helpers.ts:18–19`                      | Live DB tests sign in with the publishable key                                                                                                      |
| Type-only imports                                   | `MinutesTab.tsx:17`, `PacketTab.tsx:13`, `SaveAsTemplate.tsx:8`, `board.members.tsx:11` import `Tables` from `types.ts`                             |

Every query already filters by `organization_id`; step 10 renames that to `org_id` and routes it through `shared/supabase/org.ts`. Memberships are addressed by `membership.id` in the members screen; core memberships have no `id`, so those calls switch to `(org_id, user_id)`.

## 4. Data Board reads from or writes about the other apps

**Today: none.** Board stores no Charter or Ledger data and calls no other app. Natural cross-app links for step 14, all optional and feature-detected (§3.5):

| Board place                                                                  | Link                                                                                                                                                         | Reads through                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Documents with category **Bylaws** / **Policies** (`board.documents.tsx:24`) | `documents.charter_document_id` → a Charter document, instead of uploading a copy                                                                            | `charter.api_documents`                 |
| Motions / resolutions (e.g. "Approve the 2027 operating budget")             | `motions.charter_document_id` (adopts or amends a bylaw) and `motions.ledger_ref` (approves a budget/expense)                                                | `charter.api_documents`, `ledger.api_*` |
| Documents with category **Financial reports**; the Treasurer office          | Show Ledger reports in the board packet instead of uploading PDFs                                                                                            | `ledger.api_*` (names not known yet)    |
| Members / roster                                                             | Already shared: everyone is a `public.memberships` row. Charter "members" (association members) are a different thing from board members and stay in Charter | —                                       |

Board publishes (step 14): `board.api_meetings` (id, org_id, title, meeting_date, status) and `board.api_decisions` (motion id, org_id, meeting_id, title = motion_text, date = meeting date, status = outcome), both `security_invoker = true`.

The exact Charter and Ledger view names depend on those repos' step-14 work. **Decision D6.**

## 5. Secrets

Scanned all 155 commits (`git log --all -p`) for `sb_secret_`, `sk_live_`/`sk_test_`, `whsec_`, JWT-shaped keys (service_role), `postgres://user:password@` strings, private keys, GitHub tokens, Resend keys and Google OAuth secrets. **Nothing secret found.** Only the two Supabase **publishable** keys (Lovable project and Board's own project) and a templated connection string in a workflow (`${user}:…@${host}`). The demo password in `AGENTS.md` is intentionally public. The formal report is step 2's PR.

`.env` is tracked (publishable values only, guarded by `scripts/ci/check-env.mjs`). The spec wants `.env*` ignored except `.env.example`; step 3 untracks it and adds `.env.example`.

## 6. Demo data

`public.reset_demo()` builds "Riverside Community Association" (`d0000000-0000-0000-0000-000000000001`) with five people, writing directly into **`auth.users`, `auth.identities`, `public.organizations`, `public.memberships` and `public.profiles`**, and pg_cron reruns it every 6 hours. On the shared project that would put fake accounts and an org into the suite's production auth and core tables, which the suite rules forbid (Board never writes `public`; seed data is staging only).

Plan: rewrite it as idempotent `db/seed/0001_board_demo.sql` (step 6), run only on staging by `migrate.yml --seed`. The export helper (step 7) is not needed: the demo content is fully defined in `reset_demo()` already. **Decision D5** covers the public demo login.

## 7. Conflicts between this repo and the spec

| #   | Conflict                                                                                                                                                                                                            | Proposed resolution                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Hosting.** Board is TanStack Start with SSR on **Cloudflare Workers** (Nitro, `wrangler.jsonc`, output `.output/`), not a Vite SPA on Pages (`dist`, `public/_redirects`, `_headers`). §10 doesn't fit as written | Keep Workers. Security headers go in the server entry (`src/server.ts`) instead of `_headers`; no `_redirects` (the router handles SPA routes). Env vars go in the Worker's settings. Needs owner OK (D7) |
| C2  | **Build config.** `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which bundles TanStack Start, Nitro, Tailwind and env injection. Removing Lovable leftovers means replacing it with the plain plugins  | Step 3, in its own commit, with the build and page tests proving nothing changed                                                                                                                          |
| C3  | **Migration tooling.** Today `supabase-db.yml` runs `supabase db push`, which can't be shared by four repos (§3.3); `drizzle/` is the Lovable-era copy                                                              | Steps 4–5 replace both with `scripts/migrate.mjs`, `migrate.yml` and the `db` CI job; `supabase/migrations/`, `drizzle/` and `drizzle.config.ts` are deleted in the baseline PR                           |
| C4  | **Audit of core tables.** Board's audit trigger covers `organizations`, `memberships` and `invitations`. Those live in `public` after the move, and Board may not add triggers there                                | Board audits only `board.*`. Membership/role history becomes a hub feature request                                                                                                                        |
| C5  | **One owner per org + ownership transfer** are enforced on `public.memberships` by Board migrations                                                                                                                 | Ask the hub to put `memberships_one_owner` and `transfer_ownership` in `db/core` (D2)                                                                                                                     |
| C6  | **Current org** lives in `localStorage` (`OrgProvider`); spec uses the `oah_org` cookie                                                                                                                             | Step 10 switches to `shared/supabase/org.ts`                                                                                                                                                              |
| C7  | **`org_role` enum** has 7 values; core has 4. Board's own migration can't keep a `public.org_role` with different values                                                                                            | D1                                                                                                                                                                                                        |
| C8  | **Google sign-in** is still brokered by Lovable (`@lovable.dev/cloud-auth-js`)                                                                                                                                      | Hosted: hub does sign-in. Self-hosted: switch to `supabase.auth.signInWithOAuth` in step 3, or drop Google for self-hosted                                                                                |
| C9  | **Lovable sync.** The repo banner says it is still connected to Lovable                                                                                                                                             | Disconnect Lovable before Phase 2 lands on `main`; the new layout (no `public` tables) will break Lovable's editor/preview                                                                                |

## 8. Owner decisions needed

| #   | Question                                                                                                                                                                                                                  | Recommendation                                                                                                                   | Blocks    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D1  | Role mapping (§2.2). Keep today's rule that only owner/admin/chair/secretary edit records, via a Board officer marker? Or let every core `member` edit?                                                                   | Keep today's rule with `board.officers`                                                                                          | step 5    |
| D2  | Should the hub's core take over "exactly one owner" and `transfer_ownership`? (Core today allows several owners and only blocks removing the last one.)                                                                   | Yes; open an issue on OpenAppHub. Until then Board's self-hosted Settings keeps the transfer UI calling a core RPC               | step 5    |
| D3  | Core `profiles` has no `email`, and Board's sign-up sends `full_name`. Add `email` (or a `security definer` "member directory" RPC) to core, and have core `handle_new_user` read `full_name`/`name` into `display_name`? | Ask the hub for a core `public.org_member_directory(p_org)` RPC returning user id, display name and email for members of the org | step 5, 9 |
| D4  | Invitations: hosted mode uses the hub. Self-hosted Board still needs invites. Is `board.invitations` + a `board.accept_invitation` that inserts into `public.memberships` acceptable, or should invitations be core?      | Make invitations core (one implementation for hub and every self-hosted app)                                                     | step 5    |
| D5  | Public demo: today anyone can sign in as `demo@demo.org` on production, reset every 6 hours. On the shared project that means fake accounts in suite auth. Drop the production demo, or keep it as a hub-owned demo org?  | Drop it from production; demo lives on staging only                                                                              | step 6    |
| D6  | Cross-app links (§4): which ones do you want, and in which order relative to Charter/Ledger's `api_*` views?                                                                                                              | Start with `api_meetings`/`api_decisions` (publish) and Charter bylaws links (consume)                                           | step 14   |
| D7  | Hosting: keep Cloudflare **Workers** (SSR) instead of Pages (C1)?                                                                                                                                                         | Keep Workers                                                                                                                     | step 3    |
| D8  | §0 owner inputs are still placeholders (apex domain, prod/staging refs, design reference/outlier apps). Needed for CSP/headers (step 3), cookies (step 9) and design (step 15)                                            | Fill them in `docs/SHARED-SPEC.md` in all repos                                                                                  | step 3+   |

## 9. Dependencies on other repos

- **Nox-Mob/OpenAppHub does not exist yet.** Step 4 (vendor `shared/`, `db/core/`, `scripts/migrate.mjs`) and everything after it waits for the hub's Phase 1–2. Steps 2–3 can go ahead now.
- `Nox-Mob/OpenAppHub-docs` exists; the docs steps (16–17) target its `src/content/docs/board/`.
- Production order (START-HERE): Charter park → hub core + billing → Charter baseline → **Board baseline** → Ledger baseline → wipe Board's old project and make it staging.

## Progress

| Step  | What                  | Status                                               |
| ----- | --------------------- | ---------------------------------------------------- |
| 1     | Inventory (this file) | This PR                                              |
| 2     | Secret scan report    | Scan done (§5, clean); report PR next                |
| 3     | Hygiene               | Not started (needs D7, D8 for CSP)                   |
| 4     | Vendor shared code    | Blocked: OpenAppHub repo doesn't exist yet           |
| 5     | Board baseline        | Blocked: step 4, D1–D4                               |
| 6     | Seed                  | Blocked: step 5, D5                                  |
| 7     | Export helper         | Proposed skip (demo data is fully in `reset_demo()`) |
| 8     | DB tests              | Blocked: step 5                                      |
| 9–14  | App code              | Blocked: steps 4–5                                   |
| 15    | Design                | Blocked: hub design PR, D8                           |
| 16–17 | Docs                  | Blocked: steps 9–15                                  |
