-- Performance check (mirrors OpenCharterApp's db/perf/large-roster.sql): grows the
-- measured board to :meetings meetings, each with 10 agenda items, 12 attendees, 3
-- motions, minutes, a document and 2 action items; every other organization gets
-- a tenth as many. Then times the heavy reads as a board member, under row-level
-- security, and fails if one is over :budget_ms. Run after setup.sql, once per size
-- in increasing order; each run adds only what's missing.
\set ON_ERROR_STOP on
\if :{?budget_ms}
\else
  \set budget_ms 1000
\endif
\if :{?meetings}
\else
  \set meetings 500
\endif
select set_config('perf.meetings', :'meetings', false);
\echo
\echo '=== Board with' :meetings 'meetings (other orgs:' :meetings '/ 10 each)'

-- Seeding goes straight in as the database owner; audit rows are skipped for speed.
alter table board.meetings disable trigger t_audit;
alter table board.agenda_items disable trigger t_audit;
alter table board.attendance disable trigger t_audit;
alter table board.motions disable trigger t_audit;
alter table board.minutes disable trigger t_audit;
alter table board.documents disable trigger t_audit;
alter table board.action_items disable trigger t_audit;

insert into board.meetings (id, org_id, title, meeting_date, status)
select ('33333333-' || lpad(o::text, 4, '0') || '-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('22222222-0000-4000-8000-' || lpad(o::text, 12, '0'))::uuid,
  'Meeting ' || i, date '2000-01-01' + i * 7,
  (case when i % 50 = 0 then 'scheduled' else 'completed' end)::board.meeting_status
from generate_series(1, 41) o
cross join lateral generate_series(1, case when o = 1 then :meetings else greatest(1, :meetings / 10) end) i
on conflict (id) do nothing;

insert into board.agenda_items (org_id, meeting_id, position, title, notes)
select m.org_id, m.id, n, 'Item ' || n, repeat('Discussion. ', 20)
from board.meetings m cross join generate_series(1, 10) n
where not exists (select 1 from board.agenda_items a where a.meeting_id = m.id);

insert into board.attendance (org_id, meeting_id, person_name, user_id, status)
select m.org_id, m.id, 'Person ' || n,
  case when m.org_id = '22222222-0000-4000-8000-000000000001' then ('11111111-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid end,
  (case when n % 6 = 0 then 'absent' else 'present' end)::board.attendance_status
from board.meetings m cross join generate_series(1, 12) n
where not exists (select 1 from board.attendance a where a.meeting_id = m.id);

insert into board.motions (org_id, meeting_id, motion_text, votes_yes, votes_no, outcome)
select m.org_id, m.id, 'Motion ' || n || ' of ' || m.title, 8, 2, 'carried'
from board.meetings m cross join generate_series(1, 3) n
where not exists (select 1 from board.motions x where x.meeting_id = m.id);

insert into board.minutes (org_id, meeting_id, version, content, status)
select m.org_id, m.id, 1, repeat('Minutes text. ', 100), 'draft'
from board.meetings m
where not exists (select 1 from board.minutes x where x.meeting_id = m.id);

insert into board.documents (org_id, meeting_id, title)
select m.org_id, m.id, 'Report for ' || m.title
from board.meetings m
where not exists (select 1 from board.documents x where x.meeting_id = m.id);

insert into board.action_items (org_id, meeting_id, title, assignee_id, status)
select m.org_id, m.id, 'Task ' || n,
  case when m.org_id = '22222222-0000-4000-8000-000000000001' then ('11111111-0000-4000-8000-' || lpad((5 + n)::text, 12, '0'))::uuid end,
  (case when n = 1 then 'open' else 'done' end)::board.task_status
from board.meetings m cross join generate_series(1, 2) n
where not exists (select 1 from board.action_items x where x.meeting_id = m.id);

-- Audit history: 20 rows per meeting.
insert into board.audit_log (org_id, actor_id, action, entity, entity_id, summary)
select m.org_id, null, 'update', 'agenda_items', m.id, 'Edit ' || n
from board.meetings m cross join generate_series(1, 20) n
where not exists (select 1 from board.audit_log x where x.entity_id = m.id);

alter table board.meetings enable trigger t_audit;
alter table board.agenda_items enable trigger t_audit;
alter table board.attendance enable trigger t_audit;
alter table board.motions enable trigger t_audit;
alter table board.minutes enable trigger t_audit;
alter table board.documents enable trigger t_audit;
alter table board.action_items enable trigger t_audit;
analyze;

-- The reads, as a board member (person 10) or the secretary (person 4, audit).
begin;
select tests.as_user('11111111-0000-4000-8000-000000000010');
\timing on
\echo '--- Meetings list (newest 50)'
select count(*) from (select id from board.meetings where org_id = '22222222-0000-4000-8000-000000000001' order by meeting_date desc limit 50) x;
\echo '--- One meeting: agenda, attendance, motions, minutes'
select (select count(*) from board.agenda_items where meeting_id = m.id), (select count(*) from board.attendance where meeting_id = m.id),
  (select count(*) from board.motions where meeting_id = m.id), (select count(*) from board.minutes where meeting_id = m.id)
from board.meetings m where m.id = ('33333333-0001-4000-8000-' || lpad((:meetings / 2)::text, 12, '0'))::uuid;
\echo '--- Decisions: every motion of the board, newest first'
select count(*) from board.motions where org_id = '22222222-0000-4000-8000-000000000001';
\echo '--- My open action items'
select count(*) from board.action_items where org_id = '22222222-0000-4000-8000-000000000001' and assignee_id = auth.uid() and status = 'open';
\echo '--- Export: every meeting with its counts'
select count(*) from (select m.id, count(a.id) from board.meetings m left join board.agenda_items a on a.meeting_id = m.id
  where m.org_id = '22222222-0000-4000-8000-000000000001' group by m.id) x;
\timing off

select set_config('perf.budget_ms', :'budget_ms', true);
do $$
declare
  t timestamptz; ms numeric; budget numeric := current_setting('perf.budget_ms')::numeric; slow text := '';
  org uuid := '22222222-0000-4000-8000-000000000001';
  mtg uuid := ('33333333-0001-4000-8000-' || lpad((current_setting('perf.meetings')::int / 2)::text, 12, '0'))::uuid;
begin
  t := clock_timestamp(); perform id from board.meetings where org_id = org order by meeting_date desc limit 50;
  ms := extract(epoch from clock_timestamp() - t) * 1000; raise notice 'meetings list % ms', round(ms);
  if ms > budget then slow := slow || ' meetings-list'; end if;

  t := clock_timestamp();
  perform * from board.agenda_items where meeting_id = mtg;
  perform * from board.attendance where meeting_id = mtg;
  perform * from board.motions where meeting_id = mtg;
  perform * from board.minutes where meeting_id = mtg;
  ms := extract(epoch from clock_timestamp() - t) * 1000; raise notice 'one meeting % ms', round(ms);
  if ms > budget then slow := slow || ' one-meeting'; end if;

  t := clock_timestamp(); perform * from board.motions where org_id = org order by created_at desc;
  ms := extract(epoch from clock_timestamp() - t) * 1000; raise notice 'decisions % ms', round(ms);
  if ms > budget then slow := slow || ' decisions'; end if;

  t := clock_timestamp(); perform * from board.action_items where org_id = org and assignee_id = auth.uid() and status = 'open';
  ms := extract(epoch from clock_timestamp() - t) * 1000; raise notice 'my action items % ms', round(ms);
  if ms > budget then slow := slow || ' action-items'; end if;

  t := clock_timestamp();
  perform m.id, count(a.id) from board.meetings m left join board.agenda_items a on a.meeting_id = m.id where m.org_id = org group by m.id;
  ms := extract(epoch from clock_timestamp() - t) * 1000; raise notice 'export meetings % ms', round(ms);
  if ms > budget then slow := slow || ' export'; end if;

  -- The secretary's audit log page (newest 50).
  perform tests.as_user('11111111-0000-4000-8000-000000000004');
  t := clock_timestamp(); perform * from board.audit_log where org_id = org order by created_at desc limit 50;
  ms := extract(epoch from clock_timestamp() - t) * 1000; raise notice 'audit log % ms', round(ms);
  if ms > budget then slow := slow || ' audit-log'; end if;

  if slow <> '' then
    raise exception 'with % meetings, over the % ms budget:%', current_setting('perf.meetings'), budget, slow;
  end if;
end $$;
rollback;
