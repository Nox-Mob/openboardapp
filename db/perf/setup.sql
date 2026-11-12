-- Performance check setup: one board (the measured org) with 30 members, plus 40
-- other organizations whose records every query must skip (tenant isolation at
-- scale). grow.sql then grows the measured org's history step by step.
\set ON_ERROR_STOP on
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select ('11111111-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'person' || i || '@perf.test', now(),
  jsonb_build_object('full_name', 'Person ' || i)
from generate_series(1, 71) i;

insert into public.organizations (id, name, created_by)
select ('22222222-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'Perf board ' || i,
  ('11111111-0000-4000-8000-' || lpad(case when i = 1 then 1 else 30 + i end::text, 12, '0'))::uuid
from generate_series(1, 41) i;

-- Org 1: person 1 owns it, 2 is admin, 3 chair, 4 secretary, 5–30 members.
insert into public.memberships (org_id, user_id, role)
select '22222222-0000-4000-8000-000000000001',
  ('11111111-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  case when i = 1 then 'owner' when i = 2 then 'admin' else 'member' end::public.org_role
from generate_series(1, 30) i;
-- Orgs 2–41: persons 32–71 own one each.
insert into public.memberships (org_id, user_id, role)
select ('22222222-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('11111111-0000-4000-8000-' || lpad((30 + i)::text, 12, '0'))::uuid, 'owner'
from generate_series(2, 41) i
on conflict do nothing;
-- Their roles in this app too (H-09: separate from the OpenAppHub role).
insert into public.app_role_overrides (org_id, user_id, app, role)
select m.org_id, m.user_id, 'board', m.role from public.memberships m
where m.role in ('admin', 'member') and m.org_id::text like '22222222-0000-4000-8000-%'
on conflict do nothing;
insert into board.officers (org_id, user_id, office) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', 'chair'),
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000004', 'secretary');
