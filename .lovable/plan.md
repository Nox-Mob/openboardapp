# Live voting and the Board Meeting Dashboard

## What members will see
- A **Board Meeting Dashboard** for each meeting, with a "Join meeting" button on the meeting page and on the board home page while a meeting is In progress. It works on phones, tablets and laptops.
- It has three panels: **Agenda** (items, presenters, any motion prepared for each item), **Board packet** (the latest packet and its attached documents, opened through short-lived links), and **Vote** (the open motion, if there is one).
- The Vote panel shows the motion text, who moved and seconded it, and buttons for In favor, Opposed and Abstain. A live count shows how many members have voted. Who voted which way stays hidden until the vote closes.
- When a member taps a choice, a confirmation box opens: "This will be your official vote and it cannot be changed. Are you sure you wish to vote in the affirmative / in opposition / to abstain?" After they confirm, the panel shows "Your vote is recorded: In favor" and the buttons go away.
- Once a vote is recorded, nobody can change or delete it — not the member, the chair or the owner. The database enforces this, not just the screen.

## Who can vote
- Members vote with their own sign-in. A member can vote only if they are on the meeting's attendance list, marked present or remote, marked as a voting member, and linked to their account. The Attendance tab gets a "Linked account" picker so the secretary can connect each attendee to an organization member.
- Votes are accepted only while the meeting is **In progress**. In every other status (draft, scheduled, completed, archived) the voting buttons are hidden and the database rejects votes.

## Opening a vote (chair or secretary)
- **Prepared motions:** each agenda item gets an optional "Proposed motion" field, which meeting templates copy too. On the dashboard, the chair or secretary sees an "Open vote" button next to any item with a proposed motion. They pick the mover and seconder from the members present, then open the vote.
- **New business:** a "New motion" form (motion text, mover, seconder, optional agenda item) opens a vote right away.
- Only one vote can be open at a time in a meeting.

## Closing a vote (organization settings)
Owners and admins get two new settings:
- **How votes close** (pick one or more):
  - Chair closes it.
  - Closes automatically once every eligible member has voted.
  - Closes when a timer runs out, with the length in minutes set here.
- **Who can close a vote:** a list of roles to tick (default: Chair and Secretary, plus Owner/Admin).

When a vote closes:
- Members who did not vote are listed as "not voting".
- The in-favor, opposed and abstaining counts and each person's vote are saved to the motion as the official record. The minutes already name each voter's choice.
- The result is set as carried if more members voted in favor than opposed, and failed otherwise. The chair can still mark it tabled or withdrawn before minutes are approved.

The existing "Record a motion" form on the Motions tab stays as it is, for votes taken by show of hands.

## Technical details
- Migration (additive):
  - `agenda_items.proposed_motion` (text, nullable).
  - `organizations.vote_close_modes` (text[], default `{chair}`), `vote_timer_minutes` (int, nullable) and `vote_closer_roles` (org_role[], default owner/admin/chair/secretary).
  - `motions.voting_status` ('manual' | 'open' | 'closed', default 'manual'), plus `opened_at`, `closes_at` and `closed_at`.
  - New `member_votes` table: org, motion, attendance_id, user_id, vote, created_at, unique (motion_id, user_id), with grants, RLS (members can read all votes once the vote closes and their own vote before that), an audit trigger, and a trigger that rejects every UPDATE and DELETE.
- SECURITY DEFINER RPCs:
  - `open_vote(motion)`: checks can_edit_records, that the meeting is in progress, and that no other vote is open; sets closes_at from the timer.
  - `cast_vote(motion, vote)`: checks the meeting is in progress, the vote is open and not past closes_at, and the voter is an eligible linked attendee who hasn't voted yet. It inserts the vote and auto-closes the vote when that mode is on and everyone has voted.
  - `close_vote(motion)`: allowed for the closer roles, or for anyone once the timer has run out. It writes the totals, roll_call and outcome.
  - Direct inserts into `member_votes` are not granted.
- The existing locking trigger on motions keeps rows locked after minutes are approved.
- New route `src/routes/_authenticated/board.meetings.$meetingId.live.tsx`. The live panels poll every 3 seconds, and the timer counts down on the client, which calls `close_vote` when it reaches zero.
- New `db.voting.*` methods go through the data layer only. Pure helpers in `src/lib/votes.ts` (eligibility, outcome, close conditions).
- Tests:
  - Unit tests for eligibility and outcome.
  - Live database tests: votes are rejected unless the meeting is in progress; no double votes; no update or delete, even by the owner; only an eligible linked attendee can vote; auto-close and timer close work; votes are blocked across organizations.
  - A page test pins the new route.
- Update AGENTS.md with the voting rule. Mark live voting done in the roadmap.
