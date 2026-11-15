-- Board settings: only the organization's members see its real settings; others get defaults.
begin;
do $$
declare
  alice uuid := tests.create_user('alice@s.org', '{"full_name":"Alice"}');
  bob uuid := tests.create_user('bob@s.org', '{"full_name":"Bob"}');
  org_a uuid;
begin
  perform tests.as_user(alice);
  org_a := public.create_organization('Alpha Settings');
  insert into board.org_settings (org_id, quorum_count, timezone) values (org_a, 7, 'Europe/Paris');
  perform tests.ok((board.settings(org_a)).quorum_count = 7, 'a member sees the saved quorum');

  perform tests.as_user(bob);
  perform public.create_organization('Beta Settings');
  perform tests.ok((board.settings(org_a)).quorum_count = 1, 'another organization''s member gets the default quorum');
  perform tests.ok((board.settings(org_a)).timezone = 'America/Chicago', 'and the default time zone');

  perform tests.as_super();
  perform tests.ok((board.settings(org_a)).quorum_count = 7, 'server tasks see the saved settings');
end $$;
rollback;
