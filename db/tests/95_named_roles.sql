-- H-09 (core 0011, Board 0014): Board decides from the Board role, and named roles can grant
-- Board's permissions.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@nr.org', '{"full_name":"Olive Owner"}');
  hubadmin uuid := tests.create_user('hubadmin@nr.org', '{"full_name":"Hub Admin"}');
  clerk uuid := tests.create_user('clerk@nr.org', '{"full_name":"Clerk"}');
  newbie uuid := tests.create_user('newbie@nr.org', '{"full_name":"New Person"}');
  org uuid; clerk_role uuid; inv record;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Named Roles Board');
  perform tests.add_hub_member(org, hubadmin, 'admin');
  perform tests.add_hub_member(org, clerk, 'member');

  perform tests.ok((select count(*) from public.app_permission_types where app = 'board') = 3, 'Board offers three permissions');

  -- An OpenAppHub admin is not a Board admin, and can't be an officer as a Board viewer.
  perform tests.as_user(hubadmin);
  perform tests.ok(not board.can_manage(org), 'an OpenAppHub admin alone does not manage the board');
  perform tests.ok(not board.can_edit_records(org), 'nor edit the record');
  perform tests.as_super();
  perform tests.throws(format('insert into board.officers (org_id, user_id, office) values (%L, %L, %L)', org, hubadmin, 'chair'),
    'a Board viewer cannot hold an office', 'member in OpenBoardApp');

  -- A named role: a member in Board who may edit the official record without an office.
  perform tests.as_user(owner);
  clerk_role := public.save_named_role(org, null, 'Clerk', '', '{"board":"member"}', '{"board":["board.edit_records"]}');
  perform public.set_named_role(org, clerk, clerk_role);
  perform tests.as_user(clerk);
  perform tests.ok(public.app_role(org, 'board') = 'member', 'the clerk is a member in Board');
  perform tests.ok(board.can_edit_records(org), 'and edits the record through the named role');
  perform tests.ok(not board.can_manage(org), 'but does not manage the board');
  perform tests.ok(org in (select board.editable_org_ids()), 'set-based rules agree');
  perform tests.ok(not board.can_read_audit(org), 'and reads the audit log only when granted');
  perform tests.as_user(owner);
  perform public.save_named_role(org, clerk_role, 'Clerk', '', '{"board":"member"}', '{"board":["board.edit_records","board.read_audit"]}');
  perform tests.as_user(clerk);
  perform tests.ok(board.can_read_audit(org), 'granted: reads the audit log');

  -- An invitation from Board: an OpenAppHub member, with the Board role and office it carries.
  perform tests.as_user(owner);
  select * into inv from public.create_invitation(org, 'newbie@nr.org', 'member', 'board', '{"office":"secretary"}');
  perform public.set_invitation_roles(inv.invitation_id, null, '{"board":"admin"}');
  perform tests.as_user(newbie);
  perform public.accept_invitation(inv.token);
  perform board.on_invitation_accepted(inv.invitation_id);
  perform tests.ok(public.app_role(org, 'board') = 'admin', 'admin in Board');
  perform tests.ok(not public.has_role(org, '{owner,admin}'), 'not an OpenAppHub admin');
  perform tests.ok(board.my_office(org) = 'secretary', 'and the secretary');
end $$;
rollback;
\echo ok
