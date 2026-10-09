# Board Management App — v0.1 MVP Plan

## Note on OpenLedgerApp
OpenLedgerApp is not visible from this workspace (only Thunderbird Chapter Website/Hub, Home Hub and Resume are). Options: share its colors/fonts, move it into this workspace, or I use a calm "civic ledger" look: warm paper background, deep ink-navy, brass accent, serif headings (Fraunces) and Inter-alternative body (IBM Plex Sans), tabular, record-book feel. I will use that default unless you say otherwise.

## Build order (each step usable on its own)
1. **Foundation** — Lovable Cloud, email + Google sign-in, profiles, organizations, memberships with roles (Admin, Chair, Secretary, Treasurer, Member, Observer), org switcher, invitations by link/email, every record carries an organization and is protected by access rules.
2. **Governance** — Board roster (current and former), officer positions, terms, committees and committee members.
3. **Meetings** — Create/schedule meetings, statuses (draft, scheduled, in progress, completed, archived), agenda items with ordering, attendance and quorum display.
4. **Notes, motions & minutes** — Autosaving notes per agenda item, motions (mover, seconder, yes/no/abstain counts, outcome), "Generate minutes" builds a formal draft from agenda, attendance, notes and motions; submit for approval, approve, and lock an approved version. Later edits create a new version; approved version stays identifiable.
5. **Documents & board packet** — Private file library with versions and short-lived download links; packet assembly from agenda + attached documents, exported as PDF, each distributed packet version recorded.
6. **Action items** — Assign person + due date from a meeting or standalone; "My tasks" page; stays visible after meeting is archived.
7. **Audit & export** — Audit log of privileged changes (who, what, when); organization data export (JSON + CSV zip, documents list).
8. **Acceptance checklist** — Automated tests for tenant isolation (cross-org read/write attempts fail), minutes version locking, and permission rules.

## Pages
Sign in · Create/join organization · Dashboard (next meeting, my tasks, pending approvals) · Meetings list/detail (Agenda, Attendance, Notes, Motions, Minutes, Packet tabs) · Members & Committees · Documents · Tasks · Audit log · Settings/Export.

## Out of scope for v0.1 (per roadmap)
AI transcription, secret ballots, e-signatures, calendar/video integrations, accounting, billing, custom workflows, native apps.

## Technical details
- Cloud database with org-scoped tables; access rules use a security-definer helper `is_org_member(org, roles[])`; roles in a separate memberships table.
- Server functions with auth middleware for all writes; audit entries written by database triggers.
- Private storage bucket, signed URLs (short expiry), paths prefixed by organization id.
- PDF packets generated client-side (pdf-lib) to stay worker-safe.
- Vitest tests for permission helpers and minutes versioning rules.
