-- Integration views (SHARED-SPEC §3.6, S-03): the read-only data Board publishes for the hub
-- and the other apps. `security_invoker` makes every view run with the caller's own row
-- security, so it shows exactly what the caller could read in board.meetings and board.motions.
-- Consumers feature-detect: on a database without Board these views don't exist.
-- Columns and meanings: docs/INTEGRATION.md. Add columns at the end; never remove or rename one.

-- Meetings that are on the calendar (drafts stay private to the people preparing them).
create view board.api_meetings with (security_invoker = true) as
select
  m.id,
  m.org_id,
  m.title,
  m.meeting_date,
  m.start_time,
  m.location,
  m.status::text as status,
  (
    select mi.status::text
    from board.minutes mi
    where mi.meeting_id = m.id
    order by mi.version desc
    limit 1
  ) as minutes_status,
  (select count(*) from board.motions mo where mo.meeting_id = m.id)::int as motion_count,
  m.created_at
from board.meetings m
where m.status <> 'draft';

-- Decisions: motions with an outcome (carried, failed, tabled or withdrawn), with the vote.
create view board.api_decisions with (security_invoker = true) as
select
  mo.id,
  mo.org_id,
  mo.meeting_id,
  m.title as meeting_title,
  m.meeting_date,
  mo.motion_text,
  mo.outcome::text as outcome,
  mo.votes_yes,
  mo.votes_no,
  mo.votes_abstain,
  mo.votes_recused,
  coalesce(mo.closed_at, mo.disposition_at, mo.created_at) as decided_at
from board.motions mo
join board.meetings m on m.id = mo.meeting_id
where mo.outcome <> 'pending';

comment on view board.api_meetings is 'Board meetings on the calendar (no drafts). docs/INTEGRATION.md';
comment on view board.api_decisions is 'Board decisions: motions with an outcome. docs/INTEGRATION.md';

grant select on board.api_meetings, board.api_decisions to authenticated;
