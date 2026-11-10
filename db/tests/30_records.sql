-- Official records: minutes approval and locks, meeting locks, packets, templates,
-- letterheads, and deleting an organization with locked records.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@a.org', '{"full_name":"Olive Owner"}');
  member uuid := tests.create_user('member@a.org', '{"full_name":"Max Member"}');
  outsider uuid := tests.create_user('out@b.org');
  org uuid; org_b uuid; mtg uuid; mtg2 uuid; v1 uuid; v2 uuid; pkt uuid; act uuid;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Alpha Board');
  perform tests.add_member(org, member, 'member');
  perform tests.as_user(owner);
  insert into board.meetings (org_id, title, meeting_date, status) values (org, 'Regular', '2026-11-20', 'completed') returning id into mtg;
  insert into board.attendance (org_id, meeting_id, person_name) values (org, mtg, 'Olive');
  insert into board.motions (org_id, meeting_id, motion_text, outcome) values (org, mtg, 'Adopt budget', 'carried');
  insert into board.minutes (org_id, meeting_id, version, content) values (org, mtg, 1, 'Draft one') returning id into v1;

  -- Minutes: submitted before approved; approval is recorded and locks them.
  perform tests.throws(format('update board.minutes set status = %L where id = %L', 'approved', v1),
    'minutes must be submitted before approval', 'submitted before approval');
  update board.minutes set status = 'submitted' where id = v1;
  perform tests.ok((select submitted_at is not null from board.minutes where id = v1), 'submission time recorded');
  update board.minutes set status = 'approved' where id = v1;
  perform tests.ok((select approved_by = owner and approved_at is not null from board.minutes where id = v1), 'approval records who and when');
  perform tests.throws(format('update board.minutes set content = %L where id = %L', 'edited', v1), 'approved minutes cannot be edited', 'locked');
  perform tests.throws(format('delete from board.minutes where id = %L', v1), 'approved minutes cannot be deleted', 'official record');
  perform tests.throws(format('insert into board.minutes (org_id, meeting_id, version) values (%L, %L, 1)', org, mtg),
    'two minutes cannot share a version', 'duplicate key');

  -- An approved amendment supersedes the earlier version, which stays readable.
  insert into board.minutes (org_id, meeting_id, version, content) values (org, mtg, 2, 'Amended') returning id into v2;
  update board.minutes set status = 'submitted' where id = v2;
  update board.minutes set status = 'approved' where id = v2;
  perform tests.ok((select status from board.minutes where id = v1) = 'superseded', 'the earlier version is superseded');
  perform tests.as_user(member);
  perform tests.ok(tests.count(format('select * from board.minutes where meeting_id = %L', mtg)) = 2, 'both versions stay readable');

  -- Approved minutes lock the meeting's motions and attendance.
  perform tests.as_user(owner);
  perform tests.throws(format('update board.motions set outcome = %L where meeting_id = %L', 'failed', mtg), 'motions lock once minutes are approved', 'can no longer be changed');
  perform tests.throws(format('delete from board.attendance where meeting_id = %L', mtg), 'attendance locks once minutes are approved', 'can no longer be changed');

  -- Archived meetings lock their motions; their action items stay visible.
  insert into board.meetings (org_id, title, meeting_date) values (org, 'Special', '2026-11-27') returning id into mtg2;
  insert into board.motions (org_id, meeting_id, motion_text) values (org, mtg2, 'Hire auditor');
  insert into board.action_items (org_id, meeting_id, title) values (org, mtg2, 'Find auditor') returning id into act;
  update board.meetings set status = 'archived' where id = mtg2;
  perform tests.throws(format('delete from board.motions where meeting_id = %L', mtg2), 'archived meetings lock their motions', 'can no longer be changed');
  perform tests.ok(tests.count(format('select * from board.action_items where id = %L', act)) = 1, 'action items stay visible after archiving');

  -- Packets: inside the org folder; kept once distributed.
  perform tests.throws(format('insert into board.packets (org_id, meeting_id, version, storage_path) values (%L, %L, 1, %L)', org, mtg2, 'elsewhere/p.pdf'),
    'packet files must be in the org folder', 'organization folder');
  insert into board.packets (org_id, meeting_id, version, storage_path, distributed_at) values (org, mtg2, 1, org || '/packets/p1.pdf', now()) returning id into pkt;
  perform tests.throws(format('delete from board.packets where id = %L', pkt), 'distributed packets cannot be deleted', 'kept as a record');
  perform tests.throws(format('update board.packets set storage_path = %L where id = %L', org || '/packets/p2.pdf', pkt), 'distributed packets cannot be replaced', 'cannot be changed');

  -- Templates: editors create; members read; names unique; agenda is a list; audited.
  insert into board.meeting_templates (org_id, name, agenda) values (org, 'Regular', '[{"title":"Call to order"}]');
  perform tests.throws(format('insert into board.meeting_templates (org_id, name) values (%L, %L)', org, 'Regular'), 'template names are unique', 'duplicate key');
  perform tests.throws(format('insert into board.meeting_templates (org_id, name, agenda) values (%L, %L, %L)', org, 'Bad', '{"a":1}'), 'agenda must be a list', 'check');
  perform tests.ok(exists (select 1 from board.audit_log where entity = 'meeting_templates'), 'template changes are audited');
  perform tests.as_user(member);
  perform tests.ok(tests.count('select * from board.meeting_templates') = 1, 'members read templates');
  perform tests.throws(format('insert into board.meeting_templates (org_id, name) values (%L, %L)', org, 'Mine'), 'members cannot create templates', 'row-level security');

  -- Letterhead: owner/admin save it, members read it; files live in <org>/letterhead/.
  perform tests.as_user(owner);
  insert into board.letterheads (org_id, storage_path, file_name, mime_type) values (org, org || '/letterhead/top.png', 'top.png', 'image/png');
  perform tests.throws(format('update board.letterheads set storage_path = %L where org_id = %L', 'x/letterhead/top.png', org),
    'letterhead paths stay in the org folder', 'check');
  perform tests.as_user(member);
  perform tests.ok(tests.count('select * from board.letterheads') = 1, 'members read the letterhead');
  update board.letterheads set header_points = 100 where org_id = org;
  perform tests.ok((select header_points from board.letterheads where org_id = org) = 120, 'members cannot change the letterhead');
  perform tests.throws(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'board-files', org || '/letterhead/new.png'),
    'members cannot upload letterhead files', 'row-level security');
  perform tests.as_user(outsider);
  org_b := public.create_organization('Beta Board');
  perform tests.ok(tests.count('select * from board.letterheads') = 0, 'another organization cannot read the letterhead');

  -- Deleting the organization removes everything, locked records included.
  perform tests.as_user(owner);
  perform public.delete_organization(org, 'Alpha Board');
  perform tests.as_super();
  perform tests.ok(not exists (select 1 from board.minutes where org_id = org)
               and not exists (select 1 from board.packets where org_id = org)
               and not exists (select 1 from board.audit_log where org_id = org), 'org deletion removes locked records and the audit log');
end
$$;
rollback;
