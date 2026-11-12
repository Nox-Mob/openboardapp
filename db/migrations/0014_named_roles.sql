-- Named roles and each app's role decided on its own (core 0011, H-09).
--
-- * An officer needs a member (or admin) role in OpenBoardApp, not in OpenAppHub.
-- * OpenBoardApp registers what named roles can grant on top of the Board role: editing the
--   official record and reading the audit log (what the chair and secretary can do), and
--   managing the board (what an admin can do, without being one).

select public.register_app_permission('board', 'board.edit_records', 'Edit the official record',
  'Meetings, agendas, attendance, motions, minutes and documents; approve minutes. What the chair and secretary can do.', 10);
select public.register_app_permission('board', 'board.read_audit', 'Read the audit log',
  'See the board''s history of changes.', 20);
select public.register_app_permission('board', 'board.manage', 'Manage the board',
  'Settings, people''s offices and terms, templates and exports. What a Board admin can do.', 30);

create or replace function board.check_officer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(public.app_role(new.org_id, 'board', new.user_id) in ('owner', 'admin', 'member'), false) is not true then
    raise exception 'An officer must be a member in OpenBoardApp (not a viewer)';
  end if;
  return new;
end $$;

create or replace function board.can_manage(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write(p_org, 'board')
     and (public.has_app_role(p_org, 'board', '{owner,admin}'::public.org_role[])
          or public.has_app_permission(p_org, 'board', 'board.manage'));
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
          or coalesce(board.my_office(p_org) in ('chair', 'secretary'), false)
          or public.has_app_permission(p_org, 'board', 'board.edit_records'));
$$;

create or replace function board.can_read_audit(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_app_role(p_org, 'board', '{owner,admin}'::public.org_role[])
      or coalesce(board.my_office(p_org) in ('chair', 'secretary'), false)
      or public.has_app_permission(p_org, 'board', 'board.read_audit');
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
               where o.org_id = m.org_id and o.user_id = auth.uid() and o.office in ('chair', 'secretary')))
         or public.has_app_permission(m.org_id, 'board', 'board.edit_records'));
$$;

create or replace function board.managed_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.my_app_memberships('board') m
  where public.can_write(m.org_id, 'board')
    and (m.role in ('owner', 'admin') or public.has_app_permission(m.org_id, 'board', 'board.manage'));
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
           where o.org_id = m.org_id and o.user_id = auth.uid() and o.office in ('chair', 'secretary')))
     or public.has_app_permission(m.org_id, 'board', 'board.read_audit');
$$;

-- Invitations made in OpenBoardApp carry the Board role (public.invitations.app_roles, core
-- 0011); the office needs a member or admin role in OpenBoardApp. An invitation made before
-- H-09 (no app_roles) gives its OpenAppHub role in OpenBoardApp, as it used to.
create or replace function board.on_invitation_accepted(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_office text;
  v_role text;
begin
  select * into v_inv from public.invitations where id = p_invitation_id;
  if v_inv.id is null or v_inv.accepted_by is distinct from auth.uid() then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
  if v_inv.app is distinct from 'board' then return; end if;
  v_role := coalesce(v_inv.app_roles ->> 'board', v_inv.role::text);
  if not (coalesce(v_inv.app_roles, '{}'::jsonb) ? 'board') and v_role in ('admin', 'member') then
    insert into public.app_role_overrides (org_id, user_id, app, role, set_by)
    values (v_inv.org_id, auth.uid(), 'board', v_role::public.org_role, v_inv.invited_by)
    on conflict on constraint app_role_overrides_pkey do nothing;
  end if;
  v_office := v_inv.app_payload ->> 'office';
  if v_office is null then return; end if;
  if v_office not in ('chair', 'secretary', 'treasurer') then
    raise exception 'Unknown office %', v_office using errcode = '22023';
  end if;
  if v_role is null or v_role not in ('admin', 'member') then
    raise exception 'An office needs a member role' using errcode = '22023';
  end if;
  insert into board.officers (org_id, user_id, office)
  values (v_inv.org_id, auth.uid(), v_office::board.office)
  on conflict (org_id, user_id) do update set office = excluded.office;
end $$;
