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

-- S-15: action items for the hub's task list.
begin;
do $$
declare
  alice uuid := tests.create_user('alice@tasks.org', '{"full_name":"Alice"}');
  bob uuid := tests.create_user('bob@tasks.org', '{"full_name":"Bob"}');
  org_a uuid; item uuid;
begin
  perform tests.as_user(alice);
  org_a := public.create_organization('Tasks Board');
  insert into board.action_items (org_id, title, assignee_id, due_date) values (org_a, 'Send minutes', alice, '2026-11-20') returning id into item;
  perform tests.ok((select title || ' ' || status || ' ' || link from board.api_action_items where id = item) = 'Send minutes open /board/tasks',
    'an action item with its status and where to open it');
  perform tests.ok((select assignee_id from board.api_action_items where id = item) = alice, 'the assignee');
  perform tests.as_user(bob);
  perform tests.ok(tests.count(format('select * from board.api_action_items where org_id = %L', org_a)) = 0, 'another organization sees no action items');
end
$$;
rollback;

-- S-13: another app adds a report to an upcoming meeting.
begin;
do $$
declare
  alice uuid := tests.create_user('alice@reports.org', '{"full_name":"Alice"}');
  mem uuid := tests.create_user('mem@reports.org');
  bob uuid := tests.create_user('bob@reports.org');
  org_a uuid; upcoming uuid; held uuid; r record;
begin
  perform tests.as_user(alice);
  org_a := public.create_organization('Reports Board');
  perform tests.add_member(org_a, mem, 'member');
  insert into board.meetings (org_id, title, meeting_date, status) values (org_a, 'December', '2026-12-10', 'scheduled') returning id into upcoming;
  insert into board.meetings (org_id, title, meeting_date, status) values (org_a, 'October', '2026-10-10', 'completed') returning id into held;
  select * into r from board.add_report_to_meeting(upcoming, 'Treasurer''s report', 'Treasurer report Nov.pdf', 'ledger');
  perform tests.ok(r.storage_path = org_a || '/documents/' || r.document_id || '/v1-Treasurer_report_Nov.pdf', 'the PDF goes under Board''s document path');
  perform tests.ok((select meeting_id = upcoming and category = 'Report from OpenLedgerApp' from board.documents where id = r.document_id),
    'a document of that meeting, marked with the app it came from');
  perform tests.ok((select version = 1 and mime_type = 'application/pdf' from board.document_versions where document_id = r.document_id), 'version 1, a PDF');
  perform tests.throws(format('select * from board.add_report_to_meeting(%L, %L, %L)', held, 'Late', 'late.pdf'),
    'not for meetings that already happened', 'haven''t happened');
  perform tests.as_user(mem);
  perform tests.throws(format('select * from board.add_report_to_meeting(%L, %L, %L)', upcoming, 'Mine', 'mine.pdf'),
    'board members who can''t edit records can''t add reports', 'row-level security');
  perform tests.as_user(bob);
  perform tests.throws(format('select * from board.add_report_to_meeting(%L, %L, %L)', upcoming, 'Hijack', 'x.pdf'),
    'another organization can''t add reports', 'not found');
end
$$;
rollback;
