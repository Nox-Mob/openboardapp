-- Integration views (S-03, spec §3.6): read-only, the caller's own row security, and the
-- right rows (no drafts, decided motions only).
begin;
do $$
declare
  alice uuid := tests.create_user('alice@views.org', '{"full_name":"Alice"}');
  bob uuid := tests.create_user('bob@views.org', '{"full_name":"Bob"}');
  org_a uuid; draft uuid; held uuid; carried uuid;
begin
  perform tests.as_super();
  perform tests.ok(
    (select bool_and(c.reloptions @> array['security_invoker=true']) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'board' and c.relname in ('api_meetings', 'api_decisions')),
    'both views run with the caller''s rights (security_invoker)');

  perform tests.as_user(alice);
  org_a := public.create_organization('Views Board');
  insert into board.meetings (org_id, title, meeting_date) values (org_a, 'Draft', '2026-12-01') returning id into draft;
  insert into board.meetings (org_id, title, meeting_date, status) values (org_a, 'Held', '2026-11-01', 'completed') returning id into held;
  insert into board.minutes (org_id, meeting_id, version) values (org_a, held, 1);
  insert into board.motions (org_id, meeting_id, motion_text, outcome, votes_yes, votes_no)
    values (org_a, held, 'Adopt budget', 'carried', 4, 1) returning id into carried;
  insert into board.motions (org_id, meeting_id, motion_text) values (org_a, held, 'Still open');

  perform tests.ok(tests.count(format('select * from board.api_meetings where org_id = %L', org_a)) = 1, 'drafts are left out');
  perform tests.ok((select motion_count from board.api_meetings where id = held) = 2, 'motion count per meeting');
  perform tests.ok((select minutes_status from board.api_meetings where id = held) = 'draft', 'latest minutes status');
  perform tests.ok(tests.count(format('select * from board.api_decisions where org_id = %L', org_a)) = 1, 'only decided motions');
  perform tests.ok((select outcome || ' ' || votes_yes || '-' || votes_no from board.api_decisions where id = carried) = 'carried 4-1', 'outcome and vote');
  perform tests.throws(format('update board.api_meetings set title = %L where id = %L', 'x', held), 'the views are read-only');

  perform tests.as_user(bob);
  perform tests.ok(tests.count(format('select * from board.api_meetings where org_id = %L', org_a)) = 0, 'another organization sees no meetings');
  perform tests.ok(tests.count(format('select * from board.api_decisions where org_id = %L', org_a)) = 0, 'another organization sees no decisions');
  perform tests.as_anon();
  perform tests.throws('select * from board.api_meetings', 'signed-out visitors can''t read the views');
end
$$;
rollback;
