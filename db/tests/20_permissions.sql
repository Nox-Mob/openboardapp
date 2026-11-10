-- Roles (core role + Board office, spec §3.5), the assignee rule, the audit log,
-- read-only when the plan lapses, and officers.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@a.org', '{"full_name":"Olive Owner"}');
  admin uuid := tests.create_user('admin@a.org', '{"full_name":"Ada Admin"}');
  chair uuid := tests.create_user('chair@a.org', '{"full_name":"Cleo Chair"}');
  secretary uuid := tests.create_user('sec@a.org', '{"full_name":"Sam Secretary"}');
  treasurer uuid := tests.create_user('treas@a.org', '{"full_name":"Tess Treasurer"}');
  member uuid := tests.create_user('member@a.org', '{"full_name":"Max Member"}');
  viewer uuid := tests.create_user('viewer@a.org', '{"full_name":"Vic Viewer"}');
  org uuid; mtg uuid; task uuid; other_task uuid; who uuid;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Alpha Board');
  perform tests.add_member(org, admin, 'admin');
  perform tests.add_member(org, chair, 'member');
  perform tests.add_member(org, secretary, 'member');
  perform tests.add_member(org, treasurer, 'member');
  perform tests.add_member(org, member, 'member');
  perform tests.add_member(org, viewer, 'viewer');

  -- Officers: owner/admin manage them; a viewer can't hold an office.
  perform tests.as_user(admin);
  insert into board.officers (org_id, user_id, office) values (org, chair, 'chair'), (org, secretary, 'secretary'), (org, treasurer, 'treasurer');
  perform tests.throws(format('insert into board.officers (org_id, user_id, office) values (%L, %L, %L)', org, viewer, 'chair'),
    'a viewer cannot be an officer', 'not a viewer');
  perform tests.as_user(member);
  perform tests.throws(format('insert into board.officers (org_id, user_id, office) values (%L, %L, %L)', org, member, 'chair'),
    'a member cannot make themselves chair', 'row-level security');

  -- Who edits records.
  perform tests.as_user(chair);
  insert into board.meetings (org_id, title, meeting_date) values (org, 'Regular', '2026-11-20') returning id into mtg;
  perform tests.ok(mtg is not null, 'the chair creates a meeting');
  perform tests.as_user(secretary);
  update board.meetings set location = 'Hall' where id = mtg;
  perform tests.ok((select location from board.meetings where id = mtg) = 'Hall', 'the secretary edits a meeting');
  perform tests.as_user(admin);
  insert into board.agenda_items (org_id, meeting_id, title) values (org, mtg, 'Budget');
  perform tests.ok(tests.count(format('select * from board.agenda_items where meeting_id = %L', mtg)) = 1, 'an admin adds an agenda item');

  foreach who in array array[treasurer, member, viewer] loop
    perform tests.as_user(who);
    perform tests.ok(tests.count(format('select * from board.meetings where id = %L', mtg)) = 1, 'members and viewers read meetings');
    perform tests.throws(format('insert into board.meetings (org_id, title, meeting_date) values (%L, %L, %L)', org, 'No', '2026-12-01'),
      'treasurer, member and viewer cannot create meetings', 'row-level security');
    perform tests.throws(format('insert into board.motions (org_id, meeting_id, motion_text) values (%L, %L, %L)', org, mtg, 'No'),
      'treasurer, member and viewer cannot record motions', 'row-level security');
    update board.agenda_items set notes = 'changed' where meeting_id = mtg;
    perform tests.ok(tests.count('select * from board.audit_log') = 0, 'treasurer, member and viewer cannot read the audit log');
  end loop;
  perform tests.as_super();
  perform tests.ok((select notes from board.agenda_items where meeting_id = mtg) = '', 'their note edits were refused');

  -- The audit log: chair, secretary, owner and admin read it; nobody writes it.
  perform tests.as_user(secretary);
  perform tests.ok(tests.count('select * from board.audit_log') > 0, 'the secretary reads the audit log');
  perform tests.ok((select actor_id from board.audit_log where entity = 'meetings' and action = 'insert') = chair, 'audit records who created the meeting');
  perform tests.throws(format('insert into board.audit_log (org_id, action, entity) values (%L, %L, %L)', org, 'insert', 'fake'),
    'nobody writes audit entries', 'permission denied');
  perform tests.throws('delete from board.audit_log', 'nobody erases audit entries', 'permission denied');

  -- An assignee updates their own task, not someone else's.
  perform tests.as_user(chair);
  insert into board.action_items (org_id, title, assignee_id) values (org, 'Book the hall', member) returning id into task;
  insert into board.action_items (org_id, title, assignee_id) values (org, 'Call the bank', treasurer) returning id into other_task;
  perform tests.as_user(member);
  update board.action_items set status = 'done' where id = task;
  update board.action_items set status = 'done' where id = other_task;
  perform tests.as_super();
  perform tests.ok((select status from board.action_items where id = task) = 'done', 'an assignee updates their own task');
  perform tests.ok((select status from board.action_items where id = other_task) = 'open', 'a member cannot update someone else''s task');

  -- An officer who becomes a viewer loses the office's rights.
  update public.memberships set role = 'viewer' where org_id = org and user_id = chair;
  perform tests.as_user(chair);
  perform tests.ok(not board.can_edit_records(org), 'a chair demoted to viewer can no longer edit');
  perform tests.as_super();
  update public.memberships set role = 'member' where org_id = org and user_id = chair;

  -- Settings: a missing row means defaults; only owner/admin change them.
  perform tests.as_user(member);
  perform tests.ok((board.settings(org)).quorum_count = 1 and (board.settings(org)).decision_rule = 'majority_cast', 'defaults without a settings row');
  perform tests.throws(format('insert into board.org_settings (org_id, quorum_count) values (%L, 5)', org), 'members cannot change settings', 'row-level security');
  perform tests.as_user(admin);
  insert into board.org_settings (org_id, quorum_count, vote_closer_roles) values (org, 4, '{owner,chair}');
  perform tests.ok((board.settings(org)).quorum_count = 4, 'an admin saves settings');
  perform tests.throws(format('update board.org_settings set vote_closer_roles = %L where org_id = %L', '{king}', org), 'unknown roles refused', 'check');

  -- Plan lapsed: everyone reads, nobody writes (spec §3.4).
  perform tests.lapse(org);
  perform tests.as_user(chair);
  perform tests.ok(tests.count(format('select * from board.meetings where org_id = %L', org)) = 1, 'read-only: the chair still reads');
  perform tests.throws(format('insert into board.meetings (org_id, title, meeting_date) values (%L, %L, %L)', org, 'Lapsed', '2026-12-01'),
    'read-only: the chair cannot create meetings', 'row-level security');
  perform tests.as_user(owner);
  perform tests.ok(not board.can_manage(org) and not board.can_edit_records(org), 'read-only: the owner cannot manage or edit');
  perform tests.ok(board.can_read_audit(org), 'read-only: the owner still reads the audit log');
  perform tests.as_user(member);
  update board.action_items set status = 'in_progress' where id = task;
  perform tests.as_super();
  perform tests.ok((select status from board.action_items where id = task) = 'done', 'read-only: assignees cannot update tasks either');
end
$$;
rollback;
