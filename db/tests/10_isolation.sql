-- Tenant isolation: another organization can't read, write, attach to or export
-- anything of A's; A still reads its own.
begin;
do $$
declare
  alice uuid := tests.create_user('alice@a.org', '{"full_name":"Alice"}');
  bob uuid := tests.create_user('bob@b.org', '{"full_name":"Bob"}');
  org_a uuid; org_b uuid; mtg uuid; item uuid; doc uuid; t text;
begin
  perform tests.as_user(alice);
  org_a := public.create_organization('Alpha Board');
  insert into board.meetings (org_id, title, meeting_date) values (org_a, 'Regular', '2026-11-20') returning id into mtg;
  insert into board.agenda_items (org_id, meeting_id, title, notes) values (org_a, mtg, 'Budget', 'secret notes') returning id into item;
  insert into board.documents (org_id, title) values (org_a, 'Bylaws') returning id into doc;
  insert into board.document_versions (org_id, document_id, version, storage_path, file_name) values (org_a, doc, 1, org_a || '/bylaws.pdf', 'bylaws.pdf');
  insert into board.minutes (org_id, meeting_id, version) values (org_a, mtg, 1);
  insert into board.motions (org_id, meeting_id, motion_text) values (org_a, mtg, 'Adopt budget');
  insert into board.attendance (org_id, meeting_id, person_name) values (org_a, mtg, 'Alice');
  insert into board.action_items (org_id, title) values (org_a, 'Send minutes');
  insert into board.people (org_id, full_name) values (org_a, 'Guest Speaker');
  insert into board.org_settings (org_id, quorum_count) values (org_a, 3);
  perform tests.as_super();
  insert into storage.buckets values ('board-files', 'board-files', false) on conflict do nothing;
  insert into storage.objects (bucket_id, name) values ('board-files', org_a || '/bylaws.pdf');

  perform tests.as_user(bob);
  org_b := public.create_organization('Beta Board');
  perform tests.ok(tests.count(format('select * from board.meetings where id = %L', mtg)) = 0, 'B cannot read A''s meeting by id');
  perform tests.ok(tests.count(format('select * from board.agenda_items where id = %L', item)) = 0, 'B cannot read A''s notes');
  perform tests.ok(tests.count('select * from board.audit_log') = 0, 'B sees no audit entries of A');
  -- Every Board table returns nothing of A's (an export as B).
  for t in select table_name from information_schema.tables where table_schema = 'board' and table_type = 'BASE TABLE' loop
    perform tests.ok(tests.count(format('select * from board.%I where org_id = %L', t, org_a)) = 0, format('B reads nothing of A in board.%s', t));
  end loop;
  perform tests.throws(format('insert into board.meetings (org_id, title, meeting_date) values (%L, %L, %L)', org_a, 'Hijack', '2026-12-01'),
    'B cannot create a meeting inside A', 'row-level security');
  update board.meetings set title = 'Changed' where id = mtg;
  delete from board.meetings where id = mtg;
  perform tests.as_super();
  perform tests.ok((select title from board.meetings where id = mtg) = 'Regular', 'B cannot change or delete A''s meeting');
  perform tests.as_user(bob);
  perform tests.throws(format('insert into board.agenda_items (org_id, meeting_id, title) values (%L, %L, %L)', org_b, mtg, 'Sneaky'),
    'B cannot attach its own rows to A''s meeting', 'another organization');
  insert into board.documents (org_id, title) values (org_b, 'B doc') returning id into doc;
  perform tests.throws(format('insert into board.document_versions (org_id, document_id, version, storage_path, file_name) values (%L, %L, 1, %L, %L)',
    org_b, doc, org_a || '/bylaws.pdf', 'x.pdf'), 'B cannot point a document version at A''s folder', 'organization folder');
  perform tests.ok(tests.count(format('select * from storage.objects where name like %L', org_a || '/%')) = 0, 'B cannot see A''s files');
  perform tests.throws(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'board-files', org_a || '/evil.pdf'),
    'B cannot upload into A''s folder', 'row-level security');

  perform tests.as_user(alice);
  perform tests.ok(tests.count(format('select * from board.meetings where org_id = %L', org_a)) = 1, 'A reads its own meeting');
  perform tests.ok(tests.count(format('select * from storage.objects where name like %L', org_a || '/%')) = 1, 'A reads its own file');
  perform tests.as_anon();
  perform tests.throws('select * from board.meetings', 'anon gets nothing in board', 'permission denied');
end
$$;
rollback;
