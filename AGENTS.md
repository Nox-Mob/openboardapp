# AGENTS.md — OpenBoardApp (Nox-Mob/OpenBoardApp)

> **Branches (owner rule, 2026-11-11):** pull requests target `staging`, and every merge goes to `staging`. Nothing merges into `main` (production) without the owner's approval, or the owner merging it. CI runs on pull requests and on pushes to `staging`; only workflows that must run on `main` (releases) do.

## Suite migration (v2)

**Read `docs/SHARED-SPEC.md` (v2) first.** Your step plan is the **Progress** table in `docs/MIGRATION-NOTES.md`; this file gives the owner's answers and the changes v2 makes to it.

App ID `board` · schema `board` · hosted at `board.openapphub.org` (staging `staging.board.staging.openapphub.org`) · package manager **npm**.

Board's own project (`dnsqxiiexkdokgebysrt`) is wiped after Board moves and becomes the suite's **staging** project. Nothing in it is copied; demo content becomes seed SQL.

---

### Owner answers to your notes (§8)

| Your item       | Answer                                                                                                                                                                                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 roles        | **Keep today's rule** with `board.officers` (spec §3.5): only owner/admin/chair/secretary edit records. Treasurer and Board member = core `member`, Observer = core `viewer`. `vote_closer_roles` holds offices plus core roles.                                                                                                 |
| D2 ownership    | **Core, transferred in the hub** (spec §3.2, §4.4). One owner per org and `transfer_ownership` are in `db/core`. Hosted: Board's Settings links to the hub. Self-hosted: Board's transfer screen calls the core function. Don't recreate `memberships_one_owner` or Board's transfer RPCs.                                       |
| D3 profiles     | Core adds `public.org_member_directory(p_org)` (name, email, role) and `handle_new_user` reads `full_name`/`name`. Use it for the members list and transfer candidates.                                                                                                                                                          |
| D4 invitations  | **Core, handled by the hub** (spec §4.3). Don't create `board.invitations`. Board keeps an `/invite/<token>` page built on `shared/ui/InvitationPage`, and adds `board.on_invitation_accepted(p_invitation_id)` to apply an office from `app_payload` (for example `{ "office": "secretary" }`).                                 |
| D5 demo         | **Demo runs on staging only** (spec §11). Rewrite `reset_demo()` as `db/seed/0001_board_demo.sql`; the six-hourly reset becomes a scheduled `staging.yml` run, not `pg_cron`. Demo addresses on `@demo.openapphub.org` (not `demo@demo.org`); the password is shown only on staging's sign-in page and removed from `AGENTS.md`. |
| D6 integrations | As recommended: publish `board.api_meetings` and `board.api_decisions`; consume Charter bylaw documents later, when Charter has them (feature-detected).                                                                                                                                                                         |
| D7 hosting      | **Workers** (spec §10). Headers in `src/server.ts`.                                                                                                                                                                                                                                                                              |
| D8 inputs       | Spec §0.1 is filled in. **Design is a full refresh** for every app (spec §9).                                                                                                                                                                                                                                                    |
| C4 audit        | Audit `board.*` only; core table history is the hub's (`hub.audit_log`).                                                                                                                                                                                                                                                         |
| C8 Google       | Plain `supabase.auth.signInWithOAuth` for self-hosted; hosted sign-in is the hub.                                                                                                                                                                                                                                                |
| C9 Old editor   | **Done:** the repo is disconnected from the old editor and its tooling is removed (S-07).                                                                                                                                                                                                                                        |
| Step 7          | Skip the export helper, as you proposed.                                                                                                                                                                                                                                                                                         |

### Changes to your plan

- **Step 3 (hygiene):** also add `staging.yml` and `release.yml` (spec §10.2), switch off any build that deploys production straight from `main`, and remove the unused `client.server.ts` (Board needs no service-role key in hosted mode).
- **Step 4 (vendor):** retire `supabase-db.yml`'s push job in the same PR (spec §3.3).
- **Step 5 (baseline):**
  - `board.org_settings` for timezone, quorum and vote settings (missing row = defaults).
  - `board.officers` and `board.can_edit_records(org)` = `public.can_write(org,'board')` and (owner/admin or chair/secretary).
  - Live-voting RPCs (`start_vote`, `cast_vote`, `close_vote`, `record_disposition`, `finish_vote`) also require `public.can_write(org,'board')`, so voting stops when read-only.
  - `board.people` for people without accounts; holder tables use `user_id` **or** `person_id`, keeping `person_name` as a snapshot.
  - Bucket **`board-files`**.
  - `board.on_invitation_accepted` (above).
  - UI name limit 120 characters (core).
- **Step 10 (org scoping):** members screen addresses memberships by `(org_id, user_id)`.
- **Step 11 (hosted vs self-hosted):** hosted links out to the hub for sign-in, org creation, rename and deletion, core roles, invitations and ownership. Officers stay in Board.
- **Step 15 (design):** adopt the new shared design. Separate PRs, before/after screenshots, behaviour and visible text unchanged unless the owner approves.

### Phase 5 — Documentation (steps 16–17)

Docs live in `Nox-Mob/OpenAppHub-docs` under `src/content/docs/board/` (spec §12).

16. **Help links** (`src/config/help.ts`):

    | Screen                              | Docs path                              |
    | ----------------------------------- | -------------------------------------- |
    | User menu → Help                    | `board/`                               |
    | Live meeting dashboard, Open a vote | `board/voting/live-voting/`            |
    | Settings → live vote settings       | `board/voting/rules-and-quorum/`       |
    | Meeting → Attendance                | `board/meetings/attendance/`           |
    | Meeting → Minutes                   | `board/records/minutes/`               |
    | Meeting → Board packet              | `board/records/documents-and-packets/` |
    | Settings → Organization letterhead  | `board/records/letterhead/`            |
    | Settings → Data export              | `board/records/exports/`               |
    | Members → Board roles & terms       | `board/people/board-roles-and-terms/`  |

17. **Docs PR:**
    - `board/people/roles.md`: the new table (core role + office). This page changes the most.
    - `board/start/getting-started.md` (the demo is on staging, and its sign-in changes), `board/start/settings.md` (ownership transfer in the hub when hosted), `board/people/inviting.md`.
    - `board/help/known-limits.md`, `faq.md`, `self-hosting.md` (no `pg_cron` demo; new setup steps).
    - Any screen renamed or moved by the restyle.

### Rules for this repo

- Never write to `public`, `billing`, `hub`, `ops` or another app's schema.
- In your final Phase 2 PR, list the owner steps to retire the old project as production and reuse it as staging: update Worker vars, wipe its schemas and auth users, set `STAGING_DATABASE_URL` and `STAGING_REF`, then run `staging.yml` for every repo.

### Done when

SHARED-SPEC §13 is satisfied; Board runs on the shared project; a hub sign-in carries over to `board.openapphub.org` in the same org; a live vote stops being possible when the org is read-only; and a self-hosted build runs on an empty database with only Board's migrations and `db/core`.

---

## Current architecture rules (before the suite migration)

These describe the code as it is today. Each migration step that changes one of them updates it here in the same PR. Where they conflict with the suite migration section above or with `docs/SHARED-SPEC.md`, the spec wins. `docs/MIGRATION-NOTES.md` §7 lists which rule is replaced in which step.

- Tenancy: every tenant table carries organization_id; RLS uses security-definer helpers is_org_member / can_edit_records / can_manage_org, and same-org triggers reject cross-org parent links, so isolation never depends on the UI.
- Permissions: CAPABILITIES in src/lib/permissions.ts is the only role table and must mirror the DB helpers; src/lib/board.test.ts pins every cell.
- Data access: UI code calls only `db` from src/data, which detects the platform (src/data/platform.ts) and selects an adapter; only adapters import the database client, enforced by src/data/data-layer.test.ts. Privileged multi-step writes (create org, invites) stay SECURITY DEFINER RPCs.
- Meeting templates store their agenda as a JSON list in meeting_templates, normalized by src/lib/templates.ts on read and write, so meetings copy the outline at creation and later template edits never change existing meetings.
- Package manager: npm only (package-lock.json); no bun/yarn/pnpm lockfiles, so installs are reproducible in one tool.
- Audit: the audit_row trigger writes audit_log for every tenant table; users have no write access to audit_log.
- Official records: DB triggers lock approved/superseded minutes, motions and attendance of approved or archived meetings, and distributed packets; amendments create a new minutes version.
- Invites store only a SHA-256 hash of the token and are claimed once via accept_invitation.
- Ownership: each organization has exactly one owner (partial unique index memberships_one_owner). The creator starts as owner, and ownership moves only through the SECURITY DEFINER RPC transfer_ownership. It checks the caller is the owner, the target is another active member, and the typed name matches, then demotes the old owner to admin in the same transaction. The two-step Settings UI (src/components/TransferOwnership.tsx) is not the security boundary.
- Files: private bucket org-files, paths start with the organization id; downloads use 60-second signed URLs.
- PDFs (minutes, packets) are built client-side with pdf-lib (src/lib/packet.ts) to stay worker-safe.
- Letterhead: organization_letterheads stores the active private org-files reference; upload paths are unique, managers alone change stationery, and shared prepareLetterhead paints only generated pages with reserved header/footer space, never existing packet attachments.
- Routing: public website at /, signed-in app under /\_authenticated/board; current org is kept in localStorage via OrgProvider.
- Exports escape formula-looking text via src/lib/export.ts.
- Demo (staging only): "Riverside Community Association" (d0000000-0000-0000-0000-000000000001) is built once by db/seed/0001_board_demo.sql (`npm run db:migrate -- --seed`; Migrate → staging). Five people hold the five board positions; only one demo account (Alex Morgan, Vice President, admin, not owner) can sign in, and its sign-in is offered only where VITE_ALLOW_DEMO_LOGIN=true (staging) or on dev servers. The others use @riverside.example.org addresses with no password and are banned. Change demo content in the seed, never on page load.
- Tests: db/tests/\*.sql (npm run db:test) build a throwaway database with the migration runner and test the database rules; npm run db:perf times heavy reads up to 50,000 meetings; src/test/pages.test.tsx pins every route. Never point db tests at a real database.
- Live voting: member votes are written only through SECURITY DEFINER RPCs (start_vote, cast_vote, close_vote, record_disposition) that lock the motion row, freeze the electorate at open, and snapshot the record into motions.vote_record; member_votes/vote_electorate are immutable and protect_live_motion blocks direct edits, so official votes never depend on the UI. Vote items on the agenda may override the org decision rule (agenda_items.decision_rule, null = org default); start_vote snapshots the effective rule into vote_record.
- Board roles: board_positions holds each role and its term length; board_terms rows are the holder history (position_id links them), and handing a role over ends the open term the day before so history is never overwritten; current titles come from src/lib/titles.ts and show beside names via useTitles.
- Board record export: the zip is assembled client-side with fflate (src/components/BoardRecordExport.tsx); range/packet-as-of rules live in src/lib/board-export.ts and are pinned by its test, so exports stay worker-safe and reproducible.
- Recusal is a member_votes value ("recused"); recused members are removed from the majority-of-present denominator in finish_vote and computeDisposition, which must stay in sync.
- CI: .github/workflows/ci.yml runs npm-only, unit, database-rule, typecheck, build, lint, format and audit jobs; scripts/ci/\* hold the static checks so the same checks run locally.
- Cloudflare: wrangler.jsonc holds only overrides (Worker name, the `previews` block that per-PR `wrangler preview` builds require); Nitro merges it into the generated .output/server/wrangler.json.
- Attribution: never add a "Generated with Claude Code" footer or a Claude Code session link (claude.ai/code/session\_…) to commit messages, pull request descriptions, GitHub comments, code, comments or docs. Commits may keep a Co-Authored-By line.
