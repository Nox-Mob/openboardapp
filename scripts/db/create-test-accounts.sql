-- OpenBoard: create the CI test accounts on a Supabase project.
--
-- Creates exactly what src/test/db/helpers.ts expects, so ci.yml's
-- "Database rules" job can sign in:
--   test-a@demo.org       owner of  Test Org A  (a0000000-0000-0000-0000-00000000000a)
--   test-member@demo.org  member of Test Org A
--   test-b@demo.org       owner of  Test Org B  (b0000000-0000-0000-0000-00000000000b)
-- The passwords are the throwaway test passwords already committed in helpers.ts.
--
-- Safe to run more than once: existing accounts are reused (and their test
-- password reset), and existing test orgs and memberships are kept.
-- Refuses to run if a test account belongs to any other organization, or if a
-- real organization already uses one of the fixed test org ids (AGENTS.md: never
-- add test accounts to real orgs).
--
-- Run it as the postgres role, either:
--   * Supabase dashboard → SQL Editor → paste this file → Run, or
--   * psql "<session pooler connection string>" -v ON_ERROR_STOP=1 -f scripts/db/create-test-accounts.sql
-- Plain SQL only (no psql meta-commands), so both work.

begin;

do $$
declare
  org_a constant uuid := 'a0000000-0000-0000-0000-00000000000a';
  org_b constant uuid := 'b0000000-0000-0000-0000-00000000000b';
  acc record;
  uid uuid;
  owner_a uuid;
  member_a uuid;
  owner_b uuid;
begin
  for acc in
    select * from (values
      ('test-a@demo.org',      'test-a-1234',      'Test Owner A'),
      ('test-member@demo.org', 'test-member-1234', 'Test Member A'),
      ('test-b@demo.org',      'test-b-1234',      'Test Owner B')
    ) as v(email, password, full_name)
  loop
    select id into uid from auth.users where email = acc.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acc.email,
        extensions.crypt(acc.password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', acc.full_name), now(), now(),
        '', '', '', '', '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, 'email',
              jsonb_build_object('sub', uid::text, 'email', acc.email, 'email_verified', true),
              now(), now(), now());
      raise notice 'created %', acc.email;
    else
      update auth.users
         set encrypted_password = extensions.crypt(acc.password, extensions.gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = uid;
      raise notice 'reused %', acc.email;
    end if;

    case acc.email
      when 'test-a@demo.org' then owner_a := uid;
      when 'test-member@demo.org' then member_a := uid;
      else owner_b := uid;
    end case;
  end loop;

  -- Guards: test accounts stay out of real orgs; real orgs never get test ids.
  if exists (
    select 1 from public.memberships
    where user_id in (owner_a, member_a, owner_b) and organization_id not in (org_a, org_b)
  ) then
    raise exception 'A test account belongs to a non-test organization. Remove that membership first; nothing was changed.';
  end if;
  if exists (select 1 from public.organizations where id = org_a and name <> 'Test Org A')
     or exists (select 1 from public.organizations where id = org_b and name <> 'Test Org B') then
    raise exception 'A real organization uses a fixed test org id. Nothing was changed.';
  end if;

  insert into public.organizations (id, name, created_by) values
    (org_a, 'Test Org A', owner_a),
    (org_b, 'Test Org B', owner_b)
  on conflict (id) do nothing;

  insert into public.memberships (organization_id, user_id, role) values
    (org_a, owner_a, 'owner'),
    (org_a, member_a, 'member'),
    (org_b, owner_b, 'owner')
  on conflict (organization_id, user_id) do update set role = excluded.role
    where public.memberships.role is distinct from excluded.role;
end $$;

commit;

-- What now exists (the SQL Editor shows this result).
select u.email, o.name as organization, m.role, u.email_confirmed_at is not null as confirmed
from auth.users u
join public.memberships m on m.user_id = u.id
join public.organizations o on o.id = m.organization_id
where u.email in ('test-a@demo.org', 'test-member@demo.org', 'test-b@demo.org')
order by o.name, m.role;
