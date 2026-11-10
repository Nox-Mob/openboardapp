
create extension if not exists pgcrypto with schema extensions;

create type public.org_role as enum ('owner','admin','chair','secretary','treasurer','member','observer');
create type public.meeting_status as enum ('draft','scheduled','in_progress','completed','archived');
create type public.minutes_status as enum ('draft','submitted','approved','superseded');
create type public.attendance_status as enum ('present','absent','excused','remote');
create type public.motion_outcome as enum ('pending','carried','failed','tabled','withdrawn');
create type public.task_status as enum ('open','in_progress','done','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  timezone text not null default 'America/Chicago',
  quorum_count int not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
grant select, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;

create or replace function public.is_org_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = _org and user_id = auth.uid())
$$;
create or replace function public.has_org_role(_org uuid, _roles public.org_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = _org and user_id = auth.uid() and role = any(_roles))
$$;
create or replace function public.can_edit_records(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_org_role(_org, array['owner','admin','chair','secretary']::public.org_role[])
$$;
create or replace function public.can_manage_org(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_org_role(_org, array['owner','admin']::public.org_role[])
$$;
create or replace function public.shares_org_with(_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships a join public.memberships b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = _user)
$$;

create policy "own or co-member profiles" on public.profiles for select to authenticated using (id = auth.uid() or public.shares_org_with(id));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

create policy "members read org" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "managers update org" on public.organizations for update to authenticated using (public.can_manage_org(id));

create policy "members read memberships" on public.memberships for select to authenticated using (public.is_org_member(organization_id));
create policy "managers update memberships" on public.memberships for update to authenticated using (public.can_manage_org(organization_id) and role <> 'owner') with check (public.can_manage_org(organization_id) and role <> 'owner');
create policy "managers remove memberships" on public.memberships for delete to authenticated using (public.can_manage_org(organization_id) and role <> 'owner');

create or replace function public.create_organization(_name text, _timezone text default 'America/Chicago') returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.organizations (name, timezone, created_by) values (trim(_name), coalesce(_timezone,'America/Chicago'), auth.uid()) returning id into _id;
  insert into public.memberships (organization_id, user_id, role) values (_id, auth.uid(), 'owner');
  return _id;
end $$;
revoke execute on function public.create_organization(text,text) from public, anon;
grant execute on function public.create_organization(text,text) to authenticated;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  role public.org_role not null default 'member',
  token_hash text not null unique,
  created_by uuid not null,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
grant select, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
create policy "managers read invites" on public.invitations for select to authenticated using (public.can_manage_org(organization_id));
create policy "managers delete invites" on public.invitations for delete to authenticated using (public.can_manage_org(organization_id));

create or replace function public.create_invitation(_org uuid, _email text, _role public.org_role) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare _token text;
begin
  if not public.can_manage_org(_org) then raise exception 'Not allowed'; end if;
  if _role = 'owner' then raise exception 'Cannot invite an owner'; end if;
  _token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (organization_id, email, role, token_hash, created_by)
  values (_org, nullif(trim(lower(_email)),''), _role, encode(extensions.digest(_token, 'sha256'), 'hex'), auth.uid());
  return _token;
end $$;
revoke execute on function public.create_invitation(uuid,text,public.org_role) from public, anon;
grant execute on function public.create_invitation(uuid,text,public.org_role) to authenticated;

create or replace function public.accept_invitation(_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare _inv public.invitations;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.invitations set accepted_by = auth.uid(), accepted_at = now()
   where token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     and accepted_at is null and expires_at > now()
  returning * into _inv;
  if _inv.id is null then raise exception 'Invitation is invalid, expired or already used'; end if;
  insert into public.memberships (organization_id, user_id, role) values (_inv.organization_id, auth.uid(), _inv.role)
  on conflict (organization_id, user_id) do nothing;
  return _inv.organization_id;
end $$;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

create table public.board_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_name text not null,
  user_id uuid,
  position text not null default 'Director',
  start_date date not null,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);
create table public.committees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  person_name text not null,
  user_id uuid,
  role text not null default 'Member',
  created_at timestamptz not null default now()
);
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  start_time text,
  location text,
  status public.meeting_status not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  position int not null default 0,
  title text not null,
  presenter text,
  duration_minutes int,
  description text,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  person_name text not null,
  user_id uuid,
  status public.attendance_status not null default 'present',
  is_voting boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.motions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agenda_item_id uuid references public.agenda_items(id) on delete set null,
  motion_text text not null,
  moved_by text,
  seconded_by text,
  votes_yes int not null default 0,
  votes_no int not null default 0,
  votes_abstain int not null default 0,
  outcome public.motion_outcome not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.minutes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  version int not null,
  content text not null default '',
  status public.minutes_status not null default 'draft',
  created_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_id, version)
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  category text not null default 'General',
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version int not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);
create table public.packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  version int not null,
  storage_path text not null,
  contents jsonb not null default '[]'::jsonb,
  distributed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (meeting_id, version)
);
create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  details text,
  assignee_id uuid,
  due_date date,
  status public.task_status not null default 'open',
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function public.check_meeting_org() returns trigger language plpgsql set search_path = public as $$
begin
  if new.meeting_id is not null and not exists (select 1 from public.meetings m where m.id = new.meeting_id and m.organization_id = new.organization_id) then
    raise exception 'Meeting belongs to another organization';
  end if;
  return new;
end $$;
create trigger t_org_agenda before insert or update on public.agenda_items for each row execute function public.check_meeting_org();
create trigger t_org_att before insert or update on public.attendance for each row execute function public.check_meeting_org();
create trigger t_org_mot before insert or update on public.motions for each row execute function public.check_meeting_org();
create trigger t_org_min before insert or update on public.minutes for each row execute function public.check_meeting_org();
create trigger t_org_doc before insert or update on public.documents for each row execute function public.check_meeting_org();
create trigger t_org_pkt before insert or update on public.packets for each row execute function public.check_meeting_org();
create trigger t_org_act before insert or update on public.action_items for each row execute function public.check_meeting_org();

create or replace function public.check_committee_org() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.committees c where c.id = new.committee_id and c.organization_id = new.organization_id) then
    raise exception 'Committee belongs to another organization'; end if;
  return new;
end $$;
create trigger t_org_cm before insert or update on public.committee_members for each row execute function public.check_committee_org();

create or replace function public.check_document_org() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.documents d where d.id = new.document_id and d.organization_id = new.organization_id) then
    raise exception 'Document belongs to another organization'; end if;
  if split_part(new.storage_path, '/', 1) <> new.organization_id::text then
    raise exception 'File path must be inside the organization folder'; end if;
  return new;
end $$;
create trigger t_org_dv before insert or update on public.document_versions for each row execute function public.check_document_org();

create or replace function public.check_packet_path() returns trigger language plpgsql set search_path = public as $$
begin
  if split_part(new.storage_path, '/', 1) <> new.organization_id::text then
    raise exception 'File path must be inside the organization folder'; end if;
  return new;
end $$;
create trigger t_pkt_path before insert or update on public.packets for each row execute function public.check_packet_path();

create or replace function public.check_motion_agenda_org() returns trigger language plpgsql set search_path = public as $$
begin
  if new.agenda_item_id is not null and not exists (select 1 from public.agenda_items a where a.id = new.agenda_item_id and a.meeting_id = new.meeting_id) then
    raise exception 'Agenda item belongs to another meeting'; end if;
  return new;
end $$;
create trigger t_mot_agenda before insert or update on public.motions for each row execute function public.check_motion_agenda_org();

create or replace function public.lock_approved_minutes() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved','superseded') then raise exception 'Approved minutes are part of the official record and cannot be deleted'; end if;
    return old;
  end if;
  if old.status = 'approved' then
    if new.status = 'superseded' and new.content = old.content then return new; end if;
    raise exception 'Approved minutes are locked. Create a new version to amend them.';
  end if;
  if old.status = 'superseded' then raise exception 'Superseded minutes are locked'; end if;
  if new.status = 'approved' and old.status <> 'approved' then
    if old.status <> 'submitted' then raise exception 'Minutes must be submitted before approval'; end if;
    new.approved_by := auth.uid(); new.approved_at := now();
    update public.minutes set status = 'superseded' where meeting_id = new.meeting_id and status = 'approved' and id <> new.id;
  end if;
  if new.status = 'submitted' and old.status = 'draft' then new.submitted_at := now(); end if;
  return new;
end $$;
create trigger t_lock_minutes before update or delete on public.minutes for each row execute function public.lock_approved_minutes();

create or replace function public.lock_meeting_records() returns trigger language plpgsql set search_path = public as $$
declare _mid uuid := coalesce(new.meeting_id, old.meeting_id);
begin
  if exists (select 1 from public.minutes where meeting_id = _mid and status = 'approved')
     or exists (select 1 from public.meetings where id = _mid and status = 'archived') then
    raise exception 'This meeting''s record is approved or archived and can no longer be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger t_lock_motions before update or delete on public.motions for each row execute function public.lock_meeting_records();
create trigger t_lock_attendance before update or delete on public.attendance for each row execute function public.lock_meeting_records();

create or replace function public.lock_distributed_packets() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.distributed_at is not null then raise exception 'Distributed packets are kept as a record'; end if;
  if tg_op = 'UPDATE' and old.distributed_at is not null and (new.storage_path <> old.storage_path or new.distributed_at is distinct from old.distributed_at) then
    raise exception 'Distributed packets cannot be changed'; end if;
  return coalesce(new, old);
end $$;
create trigger t_lock_packets before update or delete on public.packets for each row execute function public.lock_distributed_packets();

do $$
declare t text;
begin
  foreach t in array array['board_terms','committees','committee_members','meetings','agenda_items','attendance','motions','minutes','documents','document_versions','packets','action_items'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_org_member(organization_id))', t);
    execute format('create policy "editors insert" on public.%I for insert to authenticated with check (public.can_edit_records(organization_id))', t);
    execute format('create policy "editors update" on public.%I for update to authenticated using (public.can_edit_records(organization_id)) with check (public.can_edit_records(organization_id))', t);
    execute format('create policy "editors delete" on public.%I for delete to authenticated using (public.can_edit_records(organization_id))', t);
  end loop;
end $$;

create policy "assignee updates own task" on public.action_items for update to authenticated
  using (assignee_id = auth.uid() and public.is_org_member(organization_id))
  with check (assignee_id = auth.uid() and public.is_org_member(organization_id));

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  summary text,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "officers read audit" on public.audit_log for select to authenticated
  using (public.has_org_role(organization_id, array['owner','admin','chair','secretary']::public.org_role[]));

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare _row jsonb; _org uuid; _summary text;
begin
  _row := to_jsonb(coalesce(new, old));
  _org := case when tg_table_name = 'organizations' then (_row->>'id')::uuid else (_row->>'organization_id')::uuid end;
  if tg_op = 'DELETE' and tg_table_name = 'organizations' then return old; end if;
  _summary := coalesce(_row->>'title', _row->>'name', _row->>'person_name', _row->>'motion_text', _row->>'file_name', _row->>'role', _row->>'status');
  if tg_op = 'UPDATE' and tg_table_name = 'agenda_items' and (to_jsonb(new) - 'notes') = (to_jsonb(old) - 'notes') then
    _row := jsonb_build_object('notes_length', length(new.notes));
  elsif tg_op = 'UPDATE' then
    _row := jsonb_build_object('before', to_jsonb(old) - 'content' - 'notes', 'after', to_jsonb(new) - 'content' - 'notes');
  else
    _row := _row - 'content' - 'notes';
  end if;
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, summary, details)
  values (_org, auth.uid(), lower(tg_op), tg_table_name, (to_jsonb(coalesce(new, old))->>'id')::uuid, left(_summary, 200), _row);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','memberships','invitations','board_terms','committees','committee_members','meetings','agenda_items','attendance','motions','minutes','documents','document_versions','packets','action_items'] loop
    execute format('create trigger t_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

create policy "org members read files" on storage.objects for select to authenticated
  using (bucket_id = 'org-files' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "org editors upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-files' and public.can_edit_records(((storage.foldername(name))[1])::uuid));

create index on public.memberships (user_id);
create index on public.meetings (organization_id, meeting_date);
create index on public.agenda_items (meeting_id, position);
create index on public.action_items (organization_id, assignee_id);
create index on public.audit_log (organization_id, created_at desc);
