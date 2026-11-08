<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# AGENTS.md — OpenBoardApp (Nox-Mob/OpenBoardApp)

**Read `docs/SHARED-SPEC.md` first. It is the contract for the whole suite.**

App ID: `board` · Schema: `board` · Hosted URL: `board.<apex-domain>`

OpenBoardApp becomes one of three sub-apps of OpenAppHub. In hosted mode, it shares one Supabase database, one login and one organization ID with the other apps, and the hub handles sign-up and payments. Self-hosted, it must still work entirely on its own. All existing data is demo/test data.

**Special situation:** Board currently runs on its **own** free Supabase project. It moves into the shared production project (the one OpenCharterApp used) under schema `board`. Afterwards, the owner wipes Board's old project and reuses it as the suite's **staging** database. So nothing in the old project needs to be preserved in place; only useful demo content gets carried over as seed data.

---

## Work order (one PR per step)

### Phase 1 — Inventory and hygiene

1. **Inventory PR.** Write `docs/MIGRATION-NOTES.md` covering:
   - every table, view, function, trigger, enum, storage bucket and Edge Function in Board's current project (from `supabase/migrations/` and `types.ts`; ask the owner for a schema dump if incomplete);
   - which concepts map onto core (`organizations`, `memberships`, `profiles`, roles) and which are Board-specific;
   - every place in the code that calls Supabase;
   - **any data Board reads from or writes about the other apps** (for example, members, charters or budgets), so it can be redesigned as cross-app links (§3.5).
2. **Secret scan** of files and git history (§7). Report findings to the owner.
3. **Hygiene:** `.env.example`, `.gitignore`, `public/_redirects` and `_headers`, CI. Remove Lovable leftovers.

### Phase 2 — Database

4. **Vendor shared code** from OpenAppHub (`shared/`, `db/core/`, `scripts/migrate.mjs`) plus `migrate.yml` and the `db` CI job.
5. **Board baseline** in `db/migrations/0001_board_baseline.sql`: Board's tables in schema `board` per the §3.4 template.
   - Every org-scoped table gets `org_id → public.organizations`.
   - Replace Board-local org/member/profile tables with core ones.
   - Board seats, officers and committee members should reference `auth.users`/`public.memberships` where the person is a user. Keep a separate `board.people` table only for non-users, such as external directors.
   - Fold the old `supabase/migrations/` into this one baseline; delete the old folder in the same PR.
   - Storage buckets use org-id path prefixes with `is_member` policies.
6. **Seed:** `db/seed/0001_board_demo.sql` with idempotent demo data (meetings, agendas, minutes, motions/votes, whatever Board has). Rewrite it from the old demo data if useful.
7. **Export helper (one-off, optional):** if the owner wants the old demo rows, add a `workflow_dispatch` workflow that dumps the selected old tables from `OLD_BOARD_DATABASE_URL` to an artifact for converting into seed SQL. The owner has no Linux machine, so everything runs in GitHub Actions.
8. **DB tests** for all board tables (isolation, viewer, read-only on expiry).

### Phase 3 — App code

9. **Supabase client:** use `shared/supabase/client.ts` (`VITE_APP_SCHEMA=board`). Use `.schema('public')` for core. Regenerate types.
10. **Org scoping** on every query and insert via `shared/supabase/org.ts`.
11. **Hosted vs self-hosted** per SHARED-SPEC §1.1: hosted → no landing/sign-up, login redirects to hub, org/members link to hub; self-hosted → keep everything.
12. **Billing state:** `BillingBanner`, write controls disabled when read-only, link to the hub's billing page.
13. **Export** of all Board data for the org (JSON/CSV), available when read-only.
14. **Integrations:**
    - Publish `board.api_*` views (meetings, decisions/resolutions with id, title, date, status) with `security_invoker = true`.
    - Where Board refers to Charter documents or Ledger items, store the foreign id and read titles through `charter.api_*` / `ledger.api_*`, feature-detected (§3.5).
    - Document everything in `docs/INTEGRATION.md`.

### Phase 4 — Design

15. Adopt `shared/design` tokens and `AppShell`. Reference app: near-invisible token swap. Outlier: restyle to match in separate PRs with before/after screenshots, without changing behaviour.

---

### Phase 5 — Documentation

Docs for this app live in the docs repo under `src/content/docs/board/` (SHARED-SPEC §12).

16. **Help links.** Add the app's help map (`src/config/help.ts`, using `shared/docs.ts`) and link these screens to their pages:

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

17. **Docs PR for this migration.** Update the `board/` tab for what Phases 2–4 changed:
    - `board/start/getting-started.md`, `board/start/settings.md` and `board/people/inviting.md`: in hosted mode, sign-in, organization creation, invitations and ownership transfer happen in the hub; describe both hosted and self-hosted where they differ.
    - `board/people/roles.md`: if Board's roles are mapped onto the shared core roles, update the permissions table to match exactly.
    - `board/help/known-limits.md` and `board/help/faq.md`: the read-only state when a hosted plan lapses, and the new data export.
    - `board/help/self-hosting.md`: new setup steps.
    - Any screen renamed or moved by the design work in Phase 4.

From then on, every PR with a user-facing change has a matching docs PR (SHARED-SPEC §12.2). When the planned reminders or backup restore ship, move them out of `board/help/known-limits.md` and document them.

## Rules specific to this repo

- After the owner confirms Board works on the shared project, list in your final PR the owner steps to retire the old project:
  1. Update Cloudflare env vars.
  2. Wipe the old project's `public` schema and auth users.
  3. Rename it to staging.
  4. Set `STAGING_DATABASE_URL`.
- Never write to `public`, `billing`, `ops` or another app's schema.

## Done when

SHARED-SPEC §11 is satisfied, Board runs on the shared project, and a hub login carries over to `board.<apex-domain>` in the same org. The `board/` docs tab matches the app, and every Help link opens a real page.

Progress and decisions for each step are tracked in `docs/MIGRATION-NOTES.md`.

---

## Current architecture rules (before the suite migration)

These describe the code as it is today. Each migration step that changes one of them updates it here in the same PR. Where they conflict with the suite work order above or with `docs/SHARED-SPEC.md`, the spec wins (see `docs/MIGRATION-NOTES.md` §7 for the known conflicts).

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
- Demo: "Riverside Community Association" (d0000000-0000-0000-0000-000000000001) is built by public.reset_demo() (supabase/migrations/20261106010000_demo_org.sql), which pg_cron reruns every 6 hours. Five people hold the five board positions, but only demo@demo.org / OpenBoardDemo!2026 (Alex Morgan, Vice President, admin, not owner) can sign in. The others use @riverside.example.org addresses with no password and are banned. Change demo content in that function, never on page load.
- Tests: src/test/db/\* run against the live backend as test-a / test-member / test-b accounts that only belong to Test Org A/B (skip with SKIP_DB_TESTS=1); src/test/pages.test.tsx pins every route; never add test accounts to real orgs.
- Live voting: member votes are written only through SECURITY DEFINER RPCs (start_vote, cast_vote, close_vote, record_disposition) that lock the motion row, freeze the electorate at open, and snapshot the record into motions.vote_record; member_votes/vote_electorate are immutable and protect_live_motion blocks direct edits, so official votes never depend on the UI. Vote items on the agenda may override the org decision rule (agenda_items.decision_rule, null = org default); start_vote snapshots the effective rule into vote_record.
- Board roles: board_positions holds each role and its term length; board_terms rows are the holder history (position_id links them), and handing a role over ends the open term the day before so history is never overwritten; current titles come from src/lib/titles.ts and show beside names via useTitles.
- Board record export: the zip is assembled client-side with fflate (src/components/BoardRecordExport.tsx); range/packet-as-of rules live in src/lib/board-export.ts and are pinned by its test, so exports stay worker-safe and reproducible.
- Recusal is a member_votes value ("recused"); recused members are removed from the majority-of-present denominator in finish_vote and computeDisposition, which must stay in sync.
- CI: .github/workflows/ci.yml runs npm-only, unit, database-rule, typecheck, build, lint, format and audit jobs; scripts/ci/\* hold the static checks so the same checks run locally.
- Cloudflare: wrangler.jsonc holds only overrides (Worker name, the `previews` block that per-PR `wrangler preview` builds require); Nitro merges it into the generated .output/server/wrangler.json.
- Attribution: never add a "Generated with Claude Code" footer or a Claude Code session link (claude.ai/code/session\_…) to commit messages, pull request descriptions, GitHub comments, code, comments or docs. Commits may keep a Co-Authored-By line.
