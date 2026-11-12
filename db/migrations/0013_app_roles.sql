-- A different role in each app (core 0010): OpenBoardApp's rules use the person's Board role
-- (public.app_role(org, 'board')), which is their OpenAppHub role unless an owner or admin set a
-- different one for Board. Offices still sit on top (chair, secretary, treasurer). Same
-- functions as the baseline, with public.memberships' role replaced by the Board role.

create or replace function board.my_office(p_org uuid)
returns board.office
language sql
stable
security definer
set search_path = ''
as $$
  select o.office from board.officers o
  where o.org_id = p_org and o.user_id = auth.uid()
    and public.has_app_role(p_org, 'board', '{owner,admin,member}'::public.org_role[]);
$$;

create or replace function board.can_manage(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write(p_org, 'board')
     and public.has_app_role(p_org, 'board', '{owner,admin}'::public.org_role[]);
$$;

create or replace function board.can_edit_records(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write(p_org, 'board')
     and (public.has_app_role(p_org, 'board', '{owner,admin}'::public.org_role[])
          or coalesce(board.my_office(p_org) in ('chair', 'secretary'), false));
$$;

create or replace function board.can_read_audit(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_app_role(p_org, 'board', '{owner,admin}'::public.org_role[])
      or coalesce(board.my_office(p_org) in ('chair', 'secretary'), false);
$$;

create or replace function board.editable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.my_app_memberships('board') m
  where public.can_write(m.org_id, 'board')
    and (m.role in ('owner', 'admin')
         or (m.role = 'member' and exists (select 1 from board.officers o
               where o.org_id = m.org_id and o.user_id = auth.uid() and o.office in ('chair', 'secretary'))));
$$;

create or replace function board.managed_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.my_app_memberships('board') m
  where m.role in ('owner', 'admin') and public.can_write(m.org_id, 'board');
$$;

create or replace function board.audit_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.my_app_memberships('board') m
  where m.role in ('owner', 'admin')
     or (m.role = 'member' and exists (select 1 from board.officers o
           where o.org_id = m.org_id and o.user_id = auth.uid() and o.office in ('chair', 'secretary')));
$$;

create or replace function board.holds_any(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role(p_org, 'board')::text = any (p_roles), false)
      or coalesce(board.my_office(p_org)::text = any (p_roles), false);
$$;
