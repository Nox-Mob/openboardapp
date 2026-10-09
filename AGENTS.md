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

# AGENTS.md — OpenBoard (board management, sister to OpenLedgerApp)

- Tenancy: every tenant table carries organization_id; RLS uses security-definer helpers is_org_member / can_edit_records / can_manage_org, and same-org triggers reject cross-org parent links, so isolation never depends on the UI.
- Permissions: CAPABILITIES in src/lib/permissions.ts is the only role table and must mirror the DB helpers; src/lib/board.test.ts pins every cell.
- Data access: pages query the generated browser client directly under RLS (no server functions yet); privileged multi-step writes (create org, invites) are SECURITY DEFINER RPCs.
- Audit: the audit_row trigger writes audit_log for every tenant table; users have no write access to audit_log.
- Official records: DB triggers lock approved/superseded minutes, motions and attendance of approved or archived meetings, and distributed packets; amendments create a new minutes version.
- Invites store only a SHA-256 hash of the token and are claimed once via accept_invitation.
- Files: private bucket org-files, paths start with the organization id; downloads use 60-second signed URLs.
- PDFs (minutes, packets) are built client-side with pdf-lib (src/lib/packet.ts) to stay worker-safe.
- Routing: public website at /, signed-in app under /_authenticated/board; current org is kept in localStorage via OrgProvider.
- Exports escape formula-looking text via src/lib/export.ts.
