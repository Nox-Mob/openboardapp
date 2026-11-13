-- No access in OpenBoardApp (0017, core 0015): no board records; roles in the other apps unchanged.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@noaccess.org');
  bob uuid := tests.create_user('bob@noaccess.org');
  org uuid;
begin
  perform tests.as_user(owner);
  org := public.create_organization('No Access Board');
  perform tests.add_hub_member(org, bob, 'member');
  perform tests.as_super();
  insert into board.meetings (org_id, title, meeting_date, status) values (org, 'March', current_date + 3, 'scheduled');
  perform tests.as_user(bob);
  perform tests.ok(tests.count(format('select 1 from board.meetings where org_id = %L', org)) = 1, 'a member of the organization sees the meetings');
  perform tests.as_user(owner);
  perform public.set_app_access(org, bob, 'board', true);
  perform tests.as_user(bob);
  perform tests.ok(tests.count(format('select 1 from board.meetings where org_id = %L', org)) = 0, 'No access: no meetings');
  perform tests.ok(tests.count(format('select 1 from board.api_meetings where org_id = %L', org)) = 0, 'not through the integration views either');
  perform tests.ok(not exists (select 1 from public.my_app_memberships('board') where org_id = org), 'the organization isn''t listed in Board');
  perform tests.ok(public.can_open_app(org, 'ledger', bob), 'other apps unchanged');
  perform tests.as_user(owner);
  perform tests.ok(tests.count(format('select 1 from board.meetings where org_id = %L', org)) = 1, 'the owner always has access');
end $$;
rollback;
