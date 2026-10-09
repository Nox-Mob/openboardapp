# Live voting and the Board Meeting Dashboard

## What members will see
- A **Board Meeting Dashboard** for each meeting, with a "Join meeting" button on the meeting page and on the board home page while a meeting is In progress. It works on phones, tablets and laptops.
- It has three panels: **Agenda** (items, presenters, any motion prepared for each item), **Board packet** (the latest packet and its attached documents, opened through short-lived links), and **Vote** (the open motion, if there is one).
- The Vote panel shows the motion text, who moved and seconded it, and buttons for In favor, Opposed and Abstain. A live count shows how many members have voted. Who voted which way stays hidden until the vote closes.
- When a member taps a choice, a confirmation box opens: "This will be your official vote and it cannot be changed. Are you sure you wish to vote in the affirmative / in opposition / to abstain?" After they confirm, the panel shows "Your vote is recorded: In favor" and the buttons go away.
- Once a vote is recorded, nobody can change or delete it — not the member, the chair or the owner. The database enforces this, not just the screen.

## Who can vote
- Members vote with their own sign-in. A member can vote only if they are on the meeting's attendance list, marked present or remote, marked as a voting member, and linked to their account. The Attendance tab gets a "Linked account" picker so the secretary can connect each attendee to an organization member.
- **The voter list is frozen when the vote opens.** The eligible voters at that moment become the vote's electorate. If the secretary marks someone present after the vote opens, that person cannot vote on it, because they were not there to hear the motion. Marking someone absent mid-vote doesn't remove them either. Anyone who doesn't vote is recorded as "did not vote".
- Votes are accepted only while the meeting is **In progress**. In every other status (draft, scheduled, completed, archived) the voting buttons are hidden and the database rejects votes.

## Opening a vote (chair or secretary)
- **Prepared motions:** each agenda item gets an optional "Proposed motion" field, which meeting templates copy too. On the dashboard, the chair or secretary sees an "Open vote" button next to any item with a proposed motion. They pick the mover and seconder from the members present, then open the vote.
- **New business:** a "New motion" form (motion text, mover, seconder, optional agenda item) opens a vote right away.
- **Only one vote can be open at a time** in a meeting. The database enforces this.
- **Seconder:** a new organization setting, "Motions require a seconder" (default on). When it's on, a vote can't open without a seconder. When it's off, the seconder is optional.

## Closing a vote (organization settings)
Owners and admins get these settings:
- **How votes close** (pick one or more):
  - Chair closes it.
  - Closes automatically once every eligible member has voted.
  - Closes when a timer runs out, with the length in minutes set here.
- **Who can close a vote:** a list of roles to tick (default: Chair and Secretary, plus Owner/Admin).
- **Decision rule:**
  - Simple majority of votes cast (abstentions don't count).
  - Majority of the eligible voters present.
  - Two-thirds of votes cast.
  - Custom / determined by the chair: the app works out no result.

## The official voting record
These facts are captured when the vote opens and closes, and stored permanently. They're viewable later on the meeting's Motions tab and in the minutes:
- The eligible electorate: the frozen list of names.
- Votes in favor, votes opposed, and abstentions, with each person's vote.
- Members who did not vote.
- Quorum information: members present, the quorum required, and whether quorum was met when the vote opened.
- The decision rule that applied.
- The resulting disposition (carried, failed, tabled, withdrawn), who recorded it, and how: calculated by the app or recorded by a person.
- When the vote opened and closed, who opened and closed it, and how it closed (by the chair, automatically, or by the timer).

**Working out the result:** the app calculates the result only when the decision rule is one of the supported ones above and quorum was met. Otherwise (a custom rule, no quorum, or a tie the rule doesn't settle) it shows the counts and asks an authorized person to record the disposition, with a required written explanation that's saved with the record.

The existing "Record a motion" form on the Motions tab stays as it is, for votes taken by show of hands.

## Technical details
- Migration (additive):
  - `agenda_items.proposed_motion` (text, nullable).
  - `organizations.vote_close_modes` (text[], default `{chair}`), `vote_timer_minutes` (int, nullable) and `vote_closer_roles` (org_role[], default owner/admin/chair/secretary).
  - `motions.voting_status` ('manual' | 'open' | 'closed', default 'manual'), plus `opened_at`, `closes_at` and `closed_at`.
  - New `member_votes` table: org, motion, attendance_id, user_id, vote, created_at, unique (motion_id, user_id), with grants, RLS (members can read all votes once the vote closes and their own vote before that), an audit trigger, and a trigger that rejects every UPDATE and DELETE.
- New `vote_electorate` table (motion, attendance_id, user_id, person_name). It is filled by `open_vote` and is insert-only and immutable, like `member_votes`.
- New organization columns: `seconder_required` (bool, default true) and `decision_rule` ('majority_cast' | 'majority_present' | 'two_thirds_cast' | 'chair', default 'majority_cast').
- New motion columns: `vote_record` jsonb (the snapshot: electorate, counts, not-voting list, quorum present/required/met, rule, closed_how, and opened_by/closed_by), plus `disposition_source` ('calculated' | 'recorded'), `disposition_note`, `disposition_by` and `disposition_at`.
- A partial unique index allows only one motion per meeting with voting_status='open'.
- SECURITY DEFINER RPCs (the only write path; direct table writes are not granted). Each runs in one transaction and takes `SELECT ... FOR UPDATE` on the motion row, so casting and closing are serialized and no vote can be accepted after close:
  - `open_vote(motion)`: checks can_edit_records, that the meeting is in progress, that no other vote is open, and the seconder rule. It freezes the electorate and records the quorum snapshot, then sets closes_at from the timer.
  - `cast_vote(motion, vote)`: locks the motion and checks, in order: the meeting is in progress; the vote is open and not past closes_at; `auth.uid()` is in the frozen electorate; the user hasn't voted yet. It inserts exactly once (unique (motion_id, user_id) guards against retries and double-clicks). It auto-closes the vote when that mode is on and the whole electorate has voted.
  - `close_vote(motion)`: locks the motion. It's allowed for the closer roles, or for anyone once the timer has run out. It writes the totals, roll_call and vote_record, and the calculated disposition when the rule is supported and quorum was met; otherwise the motion stays 'pending'.
  - `record_disposition(motion, outcome, note)`: closer roles only; the note is required. It is used when the result couldn't be calculated, or to mark a motion tabled or withdrawn.
- The existing locking trigger on motions keeps rows locked after minutes are approved.
- New route `src/routes/_authenticated/board.meetings.$meetingId.live.tsx`. The live panels poll every 3 seconds, and the timer counts down on the client, which calls `close_vote` when it reaches zero.
- New `db.voting.*` methods go through the data layer only. Pure helpers in `src/lib/votes.ts` (eligibility, outcome, close conditions).
- Tests:
  - Unit tests for eligibility and outcome.
  - Live database tests: votes are rejected unless the meeting is in progress; no double votes; no update or delete, even by the owner; only an eligible linked attendee can vote; auto-close and timer close work; votes are blocked across organizations.
  - A page test pins the new route.
- Update AGENTS.md with the voting rule. Mark live voting done in the roadmap.
