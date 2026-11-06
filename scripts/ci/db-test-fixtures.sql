-- CI-only fixtures for src/test/db/* on a freshly replayed LOCAL database.
-- Creates the dedicated test accounts and Test Org A/B that the suites expect
-- (src/test/db/helpers.ts). The passwords are the throwaway test passwords
-- already in helpers.ts. Never run this against a cloud project, and never add
-- these accounts to the demo or a real organization (AGENTS.md).
\set ON_ERROR_STOP on
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt(u.password, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name), now(), now(),
       '', '', '', '', '', '', '', ''
from (values
  ('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'test-a@demo.org', 'test-a-1234', 'Test Owner A'),
  ('aaaaaaaa-0000-4000-8000-0000000000a2'::uuid, 'test-member@demo.org', 'test-member-1234', 'Test Member A'),
  ('bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'test-b@demo.org', 'test-b-1234', 'Test Owner B')
) as u(id, email, password, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users
where email in ('test-a@demo.org', 'test-member@demo.org', 'test-b@demo.org');

insert into public.organizations (id, name, created_by) values
  ('a0000000-0000-0000-0000-00000000000a', 'Test Org A', 'aaaaaaaa-0000-4000-8000-00000000000a'),
  ('b0000000-0000-0000-0000-00000000000b', 'Test Org B', 'bbbbbbbb-0000-4000-8000-00000000000b');

insert into public.memberships (organization_id, user_id, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000a', 'owner'),
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-4000-8000-0000000000a2', 'member'),
  ('b0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-4000-8000-00000000000b', 'owner');

commit;
