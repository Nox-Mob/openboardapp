-- Board on top of core: an invitation carrying an office, people without accounts,
-- and core rules Board relies on.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@a.org', '{"full_name":"Olive Owner"}');
  sam uuid := tests.create_user('sam@a.org', '{"full_name":"Sam"}');
  vic uuid := tests.create_user('vic@a.org', '{"full_name":"Vic"}');
  org uuid; org_b uuid; tok text; inv uuid; tok2 text; inv2 uuid; guest uuid; other_guest uuid; t uuid;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Alpha Board');
  select invitation_id, token into inv, tok
  from public.create_invitation(org, 'sam@a.org', 'member', 'board', '{"office":"secretary"}'::jsonb, 14);
  select invitation_id, token into inv2, tok2
  from public.create_invitation(org, 'vic@a.org', 'viewer', 'board', '{"office":"chair"}'::jsonb, 14);

  -- The invitee accepts, then Board applies the office.
  perform tests.as_user(sam);
  perform public.accept_invitation(tok);
  perform board.on_invitation_accepted(inv);
  perform tests.ok(board.my_office(org) = 'secretary', 'the invitation made Sam secretary');
  perform tests.ok(board.can_edit_records(org), 'the secretary can edit records');
  perform board.on_invitation_accepted(inv);
  perform tests.ok(tests.count(format('select * from board.officers where org_id = %L', org)) = 1, 'applying twice is harmless');
  -- Someone else can't use Sam's invitation to get an office.
  perform tests.as_user(vic);
  perform tests.throws(format('select board.on_invitation_accepted(%L)', inv), 'only the person who accepted can apply it', 'not found');
  -- A viewer invitation can't carry an office.
  perform public.accept_invitation(tok2);
  perform tests.throws(format('select board.on_invitation_accepted(%L)', inv2), 'a viewer cannot be given an office', 'member role');

  -- People without accounts: hold terms and attend, within their own organization.
  perform tests.as_user(owner);
  insert into board.people (org_id, full_name, email) values (org, 'Dr. External', 'ext@example.org') returning id into guest;
  insert into board.terms (org_id, person_name, person_id, start_date) values (org, 'Dr. External', guest, '2026-01-01') returning id into t;
  perform tests.throws(format('insert into board.terms (org_id, person_name, person_id, user_id, start_date) values (%L, %L, %L, %L, %L)', org, 'Both', guest, sam, '2026-01-01'),
    'a term holder is a user or a person, not both', 'check');
  perform tests.throws(format('insert into board.people (org_id, full_name) values (%L, %L)', org, '  '), 'a person needs a name', 'check');
  perform tests.as_user(vic);
  org_b := public.create_organization('Beta Board');
  insert into board.people (org_id, full_name) values (org_b, 'Beta Guest') returning id into other_guest;
  insert into board.meetings (org_id, title, meeting_date) values (org_b, 'B meeting', '2026-12-01');
  perform tests.throws(format('insert into board.attendance (org_id, meeting_id, person_name, person_id) select %L, id, %L, %L from board.meetings where org_id = %L',
    org_b, 'Dr. External', guest, org_b), 'people from another organization cannot be used', 'another organization');

  -- Deleting a person keeps the term with its name snapshot.
  perform tests.as_user(owner);
  delete from board.people where id = guest;
  perform tests.ok((select person_id is null and person_name = 'Dr. External' from board.terms where id = t), 'the term keeps the name when the person is deleted');

  -- Core: Board can't change ownership or roles behind core's back.
  perform tests.as_user(sam);
  update public.memberships set role = 'owner' where org_id = org and user_id = sam;
  perform tests.as_super();
  perform tests.ok((select role from public.memberships where org_id = org and user_id = sam) = 'member', 'a member cannot make themselves owner');
end
$$;
rollback;
