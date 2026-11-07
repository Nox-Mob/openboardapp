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

# AGENTS.md — OpenBoard (board management)

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
- Routing: public website at /, signed-in app under /_authenticated/board; current org is kept in localStorage via OrgProvider.
- Exports escape formula-looking text via src/lib/export.ts.
- Demo: "Riverside Community Association" (d0000000-0000-0000-0000-000000000001) is built by public.reset_demo() (supabase/migrations/20261106010000_demo_org.sql), which pg_cron reruns every 6 hours. Five people hold the five board positions, but only demo@demo.org / OpenBoardDemo!2026 (Alex Morgan, Vice President, admin, not owner) can sign in. The others use @riverside.example.org addresses with no password and are banned. Change demo content in that function, never on page load.
- Tests: src/test/db/* run against the live backend as test-a / test-member / test-b accounts that only belong to Test Org A/B (skip with SKIP_DB_TESTS=1); src/test/pages.test.tsx pins every route; never add test accounts to real orgs.
- Live voting: member votes are written only through SECURITY DEFINER RPCs (start_vote, cast_vote, close_vote, record_disposition) that lock the motion row, freeze the electorate at open, and snapshot the record into motions.vote_record; member_votes/vote_electorate are immutable and protect_live_motion blocks direct edits, so official votes never depend on the UI. Vote items on the agenda may override the org decision rule (agenda_items.decision_rule, null = org default); start_vote snapshots the effective rule into vote_record.
- Board roles: board_positions holds each role and its term length; board_terms rows are the holder history (position_id links them), and handing a role over ends the open term the day before so history is never overwritten; current titles come from src/lib/titles.ts and show beside names via useTitles.
- Board record export: the zip is assembled client-side with fflate (src/components/BoardRecordExport.tsx); range/packet-as-of rules live in src/lib/board-export.ts and are pinned by its test, so exports stay worker-safe and reproducible.
- Recusal is a member_votes value ("recused"); recused members are removed from the majority-of-present denominator in finish_vote and computeDisposition, which must stay in sync.
- CI: .github/workflows/ci.yml runs npm-only, unit, database-rule, typecheck, build, lint, format and audit jobs; scripts/ci/* hold the static checks so the same checks run locally.
- Attribution: never add a "Generated with Claude Code" footer or a Claude Code session link (claude.ai/code/session_…) to commit messages, pull request descriptions, GitHub comments, code, comments or docs. Commits may keep a Co-Authored-By line.
