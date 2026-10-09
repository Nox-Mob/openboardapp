# Board Management App — v0.1 MVP Plan (sister app to OpenLedgerApp)

## Design taken from OpenLedgerApp
- Same warm "paper ledger" palette: paper background, deep ledger-green primary, dark warm-brown sidebar, muted tan borders.
- Same fonts: Libre Baskerville headings, IBM Plex Sans body, IBM Plex Mono for small labels, dates and record numbers.
- Same layout: dark left sidebar with org switcher, light content area, cards with thin borders, small uppercase mono eyebrows.
- A public website at `/` (green hero, like OpenLedgerApp's site); the signed-in app lives at `/board`.

## Patterns reused from OpenLedgerApp
- One permission table (role → allowed actions) that every server action checks, plus database access rules as a second layer.
- Every change saved together with its audit entry in one step; users can't edit the audit log.
- Owner = organization creator; invite links store only a hashed token and are claimed once.
- Official records are locked by the database: approved minutes and recorded votes can't be changed, only superseded by a new version.
- Shared validation for dates and names on forms and server; shared Empty/Loading/Error page states.
- Dates stored as YYYY-MM-DD in the organization's time zone.
- Exports escape formula-looking text in spreadsheets.

## Build order
1. **Foundation**: Lovable Cloud, email + Google sign-in, profiles, organizations, roles (Owner, Admin, Chair, Secretary, Treasurer, Member, Observer), org switcher, invite links.
2. **Governance**: board roster (current and former), officer positions, terms, committees.
3. **Meetings**: schedule, status (draft, scheduled, in progress, completed, archived), ordered agenda, attendance and quorum.
4. **Notes, motions & minutes**: autosaving notes per agenda item; motions with mover, seconder, yes/no/abstain counts and outcome; generate minutes, submit, approve, lock; later edits create a new version.
5. **Documents & board packet**: private library with versions and short-lived download links; packet PDF built from agenda + attachments; each distributed version recorded.
6. **Action items**: assignee + due date, "My tasks", stays visible after archive.
7. **Audit & export**: audit log page; organization export (JSON + CSV).
8. **Tests**: role table pinned cell by cell, cross-organization access attempts fail, minutes version locking.

## Out of scope for v0.1
AI transcription, secret ballots, e-signatures, calendar/video, accounting, billing, custom workflows, native apps.

## Technical details
- Tenant-owned tables all carry `organization_id`; access-rule helpers `is_org_member` / `org_can` are security definer.
- `src/lib/permissions.ts` CAPABILITIES table; server functions = requireSupabaseAuth + assertCan, then services.
- `audited_write`-style RPC for writes with audit; triggers lock approved minutes/votes.
- Private storage bucket, paths prefixed by org id, signed URLs.
- PDF via pdf-lib on the client.
