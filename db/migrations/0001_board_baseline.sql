-- OpenBoardApp baseline: Board's tables in schema `board`, on top of the
-- OpenAppHub core (db/core). Spec: docs/SHARED-SPEC.md §3.4–3.7; mapping from the
-- old public-schema database: docs/MIGRATION-NOTES.md §1–2.
--
-- Runs on the shared OpenAppHub database (hosted) and on a self-hosted Board
-- database (core + this file). Applied once by scripts/migrate.mjs.
--
-- What moved to core: organizations (name), memberships and roles, profiles,
-- invitations, ownership. Board keeps:
--   * board.org_settings   meeting and voting settings; a missing row = defaults
--   * board.officers       the office overlay: chair, secretary, treasurer
--   * board.people         people without an account (external directors, guests)
--   * every meeting, record, vote, file and audit table
--
-- Writes always go through public.can_write(org, 'board'), so a lapsed plan makes
-- Board read-only (spec §3.4). Account-related columns on official records
-- (minutes, motions, attendance, votes) are plain ids plus a name snapshot, not
-- foreign keys: those rows are locked, and an "on delete set null" would stop
-- an account from being deleted.

create schema if not exists board;
revoke all on schema board from public, anon;
grant usage on schema board to authenticated, service_role;

-- Types ---------------------------------------------------------------------------

create type board.office as enum ('chair', 'secretary', 'treasurer');
create type board.meeting_status as enum ('draft', 'scheduled', 'in_progress', 'completed', 'archived');
create type board.minutes_status as enum ('draft', 'submitted', 'approved', 'superseded');
create type board.attendance_status as enum ('present', 'absent', 'excused', 'remote');
create type board.motion_outcome as enum ('pending', 'carried', 'failed', 'tabled', 'withdrawn');
create type board.task_status as enum ('open', 'in_progress', 'done', 'cancelled');

-- Settings, officers, people ------------------------------------------------------------

create table board.org_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  timezone text not null default 'America/Chicago',
  quorum_count int not null default 1 check (quorum_count >= 0),
  vote_recording text not null default 'totals' check (vote_recording in ('totals', 'roll_call')),
  vote_close_modes text[] not null default '{chair}'
    check (cardinality(vote_close_modes) >= 1 and vote_close_modes <@ array['chair', 'auto', 'timer']::text[]),
  vote_timer_minutes int check (vote_timer_minutes is null or vote_timer_minutes between 1 and 240),
  -- A mix of core roles and offices.
  vote_closer_roles text[] not null default '{owner,admin,chair,secretary}'
    check (cardinality(vote_closer_roles) >= 1
      and vote_closer_roles <@ array['owner', 'admin', 'chair', 'secretary', 'treasurer', 'member']::text[]),
  seconder_required boolean not null default true,
  decision_rule text not null default 'majority_cast'
    check (decision_rule in ('majority_cast', 'majority_present', 'two_thirds_cast', 'chair')),
  updated_at timestamptz not null default now()
);

create table board.officers (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  office board.office not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table board.people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text check (email is null or email = lower(btrim(email))),
  notes text,
  created_at timestamptz not null default now()
);

-- Helpers -------------------------------------------------------------------------------

-- Settings with defaults for organizations that have no row yet.
create or replace function board.settings(p_org uuid)
returns board.org_settings
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s from board.org_settings s where s.org_id = p_org),
    row(p_org, 'America/Chicago', 1, 'totals', '{chair}'::text[], null::int,
        '{owner,admin,chair,secretary}'::text[], true, 'majority_cast', now())::board.org_settings
  );
$$;

create or replace function board.my_office(p_org uuid)
returns board.office
language sql
stable
security definer
set search_path = ''
as $$
  select o.office from board.officers o
  where o.org_id = p_org and o.user_id = auth.uid()
    and public.has_role(p_org, '{owner,admin,member}'::public.org_role[]);
$$;

-- Owner or admin, and the org is writable.
create or replace function board.can_manage(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write(p_org, 'board')
     and public.has_role(p_org, '{owner,admin}'::public.org_role[]);
$$;

-- Board's write helper (spec §3.5): writable org, and owner/admin or chair/secretary.
create or replace function board.can_edit_records(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write(p_org, 'board')
     and (public.has_role(p_org, '{owner,admin}'::public.org_role[])
          or coalesce(board.my_office(p_org) in ('chair', 'secretary'), false));
$$;

-- Reading the audit log: owner/admin or chair/secretary (a read, so no can_write).
create or replace function board.can_read_audit(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_org, '{owner,admin}'::public.org_role[])
      or coalesce(board.my_office(p_org) in ('chair', 'secretary'), false);
$$;

-- Set-based versions for row rules: Postgres works each out once per query instead of
-- once per row, so reads stay fast on large histories (db/perf).
create or replace function board.readable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m where m.user_id = auth.uid();
$$;

create or replace function board.editable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and public.can_write(m.org_id, 'board')
    and (m.role in ('owner', 'admin')
         or (m.role = 'member' and exists (select 1 from board.officers o
               where o.org_id = m.org_id and o.user_id = m.user_id and o.office in ('chair', 'secretary'))));
$$;

create or replace function board.managed_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and m.role in ('owner', 'admin') and public.can_write(m.org_id, 'board');
$$;

create or replace function board.audit_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid()
    and (m.role in ('owner', 'admin')
         or (m.role = 'member' and exists (select 1 from board.officers o
               where o.org_id = m.org_id and o.user_id = m.user_id and o.office in ('chair', 'secretary'))));
$$;

-- True when the caller holds one of the given core roles or offices.
create or replace function board.holds_any(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role::text = any (p_roles)
  ) or coalesce(board.my_office(p_org)::text = any (p_roles), false);
$$;

-- Tables ------------------------------------------------------------------------------

create table board.positions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  term_years int check (term_years is null or term_years between 1 and 10),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, title)
);

create table board.terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  person_name text not null,
  user_id uuid references auth.users (id) on delete set null,
  person_id uuid references board.people (id) on delete set null,
  position text not null default 'Director',
  position_id uuid references board.positions (id) on delete set null,
  start_date date not null,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  check (user_id is null or person_id is null)
);

create table board.committees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table board.committee_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  committee_id uuid not null references board.committees (id) on delete cascade,
  person_name text not null,
  user_id uuid references auth.users (id) on delete set null,
  person_id uuid references board.people (id) on delete set null,
  role text not null default 'Member',
  created_at timestamptz not null default now(),
  check (user_id is null or person_id is null)
);

create table board.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  meeting_date date not null,
  start_time text,
  location text,
  status board.meeting_status not null default 'draft',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table board.agenda_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references board.meetings (id) on delete cascade,
  position int not null default 0,
  title text not null,
  presenter text,
  duration_minutes int,
  description text,
  notes text not null default '',
  proposed_motion text,
  is_vote_item boolean not null default false,
  decision_rule text check (decision_rule is null
    or decision_rule in ('majority_cast', 'majority_present', 'two_thirds_cast', 'chair')),
  created_at timestamptz not null default now()
);

create table board.attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references board.meetings (id) on delete cascade,
  person_name text not null,
  user_id uuid,
  person_id uuid references board.people (id) on delete set null,
  status board.attendance_status not null default 'present',
  is_voting boolean not null default true,
  created_at timestamptz not null default now(),
  check (user_id is null or person_id is null)
);

create table board.motions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references board.meetings (id) on delete cascade,
  agenda_item_id uuid references board.agenda_items (id) on delete set null,
  motion_text text not null,
  moved_by text,
  seconded_by text,
  votes_yes int not null default 0,
  votes_no int not null default 0,
  votes_abstain int not null default 0,
  votes_recused int not null default 0,
  outcome board.motion_outcome not null default 'pending',
  roll_call jsonb check (roll_call is null or jsonb_typeof(roll_call) = 'array'),
  voting_status text not null default 'manual' check (voting_status in ('manual', 'open', 'closed')),
  opened_at timestamptz,
  opened_by uuid,
  closes_at timestamptz,
  closed_at timestamptz,
  closed_by uuid,
  vote_record jsonb,
  disposition_source text check (disposition_source is null or disposition_source in ('calculated', 'recorded')),
  disposition_note text,
  disposition_by uuid,
  disposition_at timestamptz,
  created_at timestamptz not null default now()
);
comment on column board.motions.roll_call is
  'Optional per-member votes: [{person_name, attendance_id, vote}]. The totals columns stay the authoritative counts.';
create unique index motions_one_open_vote on board.motions (meeting_id) where voting_status = 'open';

create table board.minutes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references board.meetings (id) on delete cascade,
  version int not null,
  content text not null default '',
  status board.minutes_status not null default 'draft',
  created_by uuid default auth.uid(),
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_id, version)
);

create table board.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid references board.meetings (id) on delete set null,
  title text not null,
  category text not null default 'General',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table board.document_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references board.documents (id) on delete cascade,
  version int not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create table board.packets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references board.meetings (id) on delete cascade,
  version int not null,
  storage_path text not null,
  contents jsonb not null default '[]'::jsonb,
  distributed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (meeting_id, version)
);

create table board.action_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid references board.meetings (id) on delete set null,
  title text not null,
  details text,
  assignee_id uuid references auth.users (id) on delete set null,
  due_date date,
  status board.task_status not null default 'open',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table board.meeting_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  meeting_title text not null default 'Regular Board Meeting',
  start_time text,
  location text,
  agenda jsonb not null default '[]'::jsonb check (jsonb_typeof(agenda) = 'array'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

-- Live votes: frozen electorate and individual votes. Never changed or deleted;
-- an organization deletion removes them with everything else.
create table board.vote_electorate (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  motion_id uuid not null references board.motions (id) on delete cascade,
  attendance_id uuid,
  user_id uuid not null,
  person_name text not null,
  created_at timestamptz not null default now(),
  unique (motion_id, user_id)
);

create table board.member_votes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  motion_id uuid not null references board.motions (id) on delete cascade,
  attendance_id uuid,
  user_id uuid not null,
  person_name text not null,
  vote text not null check (vote in ('yes', 'no', 'abstain', 'recused')),
  created_at timestamptz not null default now(),
  unique (motion_id, user_id)
);

create table board.letterheads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'application/pdf')),
  header_points int not null default 120 check (header_points between 72 and 216),
  footer_points int not null default 54 check (footer_points between 36 and 108),
  updated_at timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = org_id::text and split_part(storage_path, '/', 2) = 'letterhead')
);

create table board.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  summary text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Indexes -----------------------------------------------------------------------------

create index on board.officers (user_id);
create index on board.people (org_id);
create index on board.positions (org_id);
create index on board.terms (org_id);
create index on board.terms (position_id);
create index on board.committees (org_id);
create index on board.committee_members (committee_id);
create index on board.committee_members (org_id);
create index on board.meetings (org_id, meeting_date);
create index on board.agenda_items (meeting_id, position);
create index on board.agenda_items (org_id);
create index on board.attendance (meeting_id);
create index on board.attendance (org_id);
create index on board.motions (meeting_id);
create index on board.motions (org_id);
create index on board.minutes (org_id);
create index on board.documents (org_id);
create index on board.documents (meeting_id);
create index on board.document_versions (document_id);
create index on board.document_versions (org_id);
create index on board.packets (org_id);
create index on board.action_items (org_id, assignee_id);
create index on board.action_items (meeting_id);
create index on board.meeting_templates (org_id);
create index on board.vote_electorate (motion_id);
create index on board.vote_electorate (org_id);
create index on board.member_votes (motion_id);
create index on board.member_votes (org_id);
create index on board.audit_log (org_id, created_at desc);

-- Same-organization checks -------------------------------------------------------------

create or replace function board.check_meeting_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.meeting_id is not null and not exists (
    select 1 from board.meetings m where m.id = new.meeting_id and m.org_id = new.org_id
  ) then
    raise exception 'Meeting belongs to another organization';
  end if;
  return new;
end $$;

create trigger t_org_agenda before insert or update on board.agenda_items for each row execute function board.check_meeting_org();
create trigger t_org_att before insert or update on board.attendance for each row execute function board.check_meeting_org();
create trigger t_org_mot before insert or update on board.motions for each row execute function board.check_meeting_org();
create trigger t_org_min before insert or update on board.minutes for each row execute function board.check_meeting_org();
create trigger t_org_doc before insert or update on board.documents for each row execute function board.check_meeting_org();
create trigger t_org_pkt before insert or update on board.packets for each row execute function board.check_meeting_org();
create trigger t_org_act before insert or update on board.action_items for each row execute function board.check_meeting_org();

create or replace function board.check_committee_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from board.committees c where c.id = new.committee_id and c.org_id = new.org_id) then
    raise exception 'Committee belongs to another organization';
  end if;
  return new;
end $$;
create trigger t_org_cm before insert or update on board.committee_members for each row execute function board.check_committee_org();

create or replace function board.check_document_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from board.documents d where d.id = new.document_id and d.org_id = new.org_id) then
    raise exception 'Document belongs to another organization';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.org_id::text then
    raise exception 'File path must be inside the organization folder';
  end if;
  return new;
end $$;
create trigger t_org_dv before insert or update on board.document_versions for each row execute function board.check_document_org();

create or replace function board.check_packet_path()
returns trigger language plpgsql set search_path = '' as $$
begin
  if split_part(new.storage_path, '/', 1) <> new.org_id::text then
    raise exception 'File path must be inside the organization folder';
  end if;
  return new;
end $$;
create trigger t_pkt_path before insert or update on board.packets for each row execute function board.check_packet_path();

create or replace function board.check_motion_agenda_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.agenda_item_id is not null and not exists (
    select 1 from board.agenda_items a where a.id = new.agenda_item_id and a.meeting_id = new.meeting_id
  ) then
    raise exception 'Agenda item belongs to another meeting';
  end if;
  return new;
end $$;
create trigger t_mot_agenda before insert or update on board.motions for each row execute function board.check_motion_agenda_org();

create or replace function board.check_term_position_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.position_id is not null and not exists (
    select 1 from board.positions p where p.id = new.position_id and p.org_id = new.org_id
  ) then
    raise exception 'Board role belongs to another organization';
  end if;
  return new;
end $$;
create trigger t_org_term_pos before insert or update on board.terms for each row execute function board.check_term_position_org();

-- People and officers must belong to the same organization.
create or replace function board.check_person_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.person_id is not null and not exists (
    select 1 from board.people p where p.id = new.person_id and p.org_id = new.org_id
  ) then
    raise exception 'Person belongs to another organization';
  end if;
  return new;
end $$;
create trigger t_org_term_person before insert or update on board.terms for each row execute function board.check_person_org();
create trigger t_org_cm_person before insert or update on board.committee_members for each row execute function board.check_person_org();
create trigger t_org_att_person before insert or update on board.attendance for each row execute function board.check_person_org();

create or replace function board.check_officer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.memberships m
    where m.org_id = new.org_id and m.user_id = new.user_id and m.role in ('owner', 'admin', 'member')
  ) then
    raise exception 'An officer must be a member of the organization (not a viewer)';
  end if;
  return new;
end $$;
create trigger t_officer_member before insert or update on board.officers for each row execute function board.check_officer();

-- An officer who leaves the organization or becomes a viewer keeps the row, but it
-- no longer counts: board.my_office() requires core member or higher.

-- Record locks --------------------------------------------------------------------------
-- Deleting an organization (core delete_organization) cascades into Board. By the
-- time the cascade reaches these rows the organization row is gone, so the locks
-- stand aside for that and only that.

create or replace function board.org_gone(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.organizations o where o.id = p_org);
$$;


create or replace function board.lock_approved_minutes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved', 'superseded') and not board.org_gone(old.org_id) then
      raise exception 'Approved minutes are part of the official record and cannot be deleted';
    end if;
    return old;
  end if;
  if old.status = 'approved' then
    if new.status = 'superseded' and new.content = old.content then return new; end if;
    raise exception 'Approved minutes are locked. Create a new version to amend them.';
  end if;
  if old.status = 'superseded' then raise exception 'Superseded minutes are locked'; end if;
  if new.status = 'approved' and old.status <> 'approved' then
    if old.status <> 'submitted' then raise exception 'Minutes must be submitted before approval'; end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
    update board.minutes set status = 'superseded'
    where meeting_id = new.meeting_id and status = 'approved' and id <> new.id;
  end if;
  if new.status = 'submitted' and old.status = 'draft' then new.submitted_at := now(); end if;
  return new;
end $$;
create trigger t_lock_minutes before update or delete on board.minutes for each row execute function board.lock_approved_minutes();

create or replace function board.lock_meeting_records()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_meeting uuid := coalesce(new.meeting_id, old.meeting_id);
begin
  if board.org_gone(coalesce(new.org_id, old.org_id)) then return coalesce(new, old); end if;
  if exists (select 1 from board.minutes where meeting_id = v_meeting and status = 'approved')
     or exists (select 1 from board.meetings where id = v_meeting and status = 'archived') then
    raise exception 'This meeting''s record is approved or archived and can no longer be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger t_lock_motions before update or delete on board.motions for each row execute function board.lock_meeting_records();
create trigger t_lock_attendance before update or delete on board.attendance for each row execute function board.lock_meeting_records();

create or replace function board.lock_distributed_packets()
returns trigger language plpgsql set search_path = '' as $$
begin
  if board.org_gone(old.org_id) then return coalesce(new, old); end if;
  if tg_op = 'DELETE' and old.distributed_at is not null then
    raise exception 'Distributed packets are kept as a record';
  end if;
  if tg_op = 'UPDATE' and old.distributed_at is not null
     and (new.storage_path <> old.storage_path or new.distributed_at is distinct from old.distributed_at) then
    raise exception 'Distributed packets cannot be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger t_lock_packets before update or delete on board.packets for each row execute function board.lock_distributed_packets();

create or replace function board.reject_vote_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and board.org_gone(old.org_id) then return old; end if;
  raise exception 'Recorded votes are part of the official record and can never be changed or deleted';
end $$;
create trigger t_immutable before update or delete on board.member_votes for each row execute function board.reject_vote_change();
create trigger t_immutable before update or delete on board.vote_electorate for each row execute function board.reject_vote_change();

-- Live-voted motions change only through the voting functions below.
create or replace function board.protect_live_motion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.vote_rpc', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' and board.org_gone(old.org_id) then return old; end if;
  if tg_op = 'INSERT' then
    if new.voting_status <> 'manual' or new.vote_record is not null then
      raise exception 'Live votes can only be opened through the voting process';
    end if;
    return new;
  end if;
  if old.voting_status <> 'manual' then
    raise exception 'Live votes are part of the official record and can only change through the voting process';
  end if;
  if tg_op = 'UPDATE' and (new.voting_status <> 'manual' or new.vote_record is not null) then
    raise exception 'Live votes can only be opened through the voting process';
  end if;
  return coalesce(new, old);
end $$;
create trigger t_live_motion before insert or update or delete on board.motions for each row execute function board.protect_live_motion();

-- Audit ---------------------------------------------------------------------------------

create or replace function board.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_org uuid := (to_jsonb(coalesce(new, old)) ->> 'org_id')::uuid;
  v_summary text;
begin
  -- No audit rows for an organization that is being deleted.
  if board.org_gone(v_org) then return coalesce(new, old); end if;
  v_summary := coalesce(v_row ->> 'title', v_row ->> 'name', v_row ->> 'person_name', v_row ->> 'full_name',
    v_row ->> 'motion_text', v_row ->> 'file_name', v_row ->> 'office', v_row ->> 'status');
  if tg_op = 'UPDATE' and tg_table_name = 'agenda_items' and (to_jsonb(new) - 'notes') = (to_jsonb(old) - 'notes') then
    v_row := jsonb_build_object('notes_length', length(new.notes));
  elsif tg_op = 'UPDATE' then
    v_row := jsonb_build_object('before', to_jsonb(old) - 'content' - 'notes', 'after', to_jsonb(new) - 'content' - 'notes');
  else
    v_row := v_row - 'content' - 'notes';
  end if;
  insert into board.audit_log (org_id, actor_id, action, entity, entity_id, summary, details)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name,
    case when to_jsonb(coalesce(new, old)) ? 'id' and (to_jsonb(coalesce(new, old)) ->> 'id') ~ '^[0-9a-f-]{36}$'
      then (to_jsonb(coalesce(new, old)) ->> 'id')::uuid end,
    left(v_summary, 200), v_row);
  return coalesce(new, old);
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['org_settings', 'officers', 'people', 'positions', 'terms', 'committees',
    'committee_members', 'meetings', 'agenda_items', 'attendance', 'motions', 'minutes', 'documents',
    'document_versions', 'packets', 'action_items', 'meeting_templates', 'letterheads'] loop
    execute format('create trigger t_audit after insert or update or delete on board.%I for each row execute function board.audit_row()', t);
  end loop;
end $$;
create trigger t_audit after insert on board.member_votes for each row execute function board.audit_row();
create trigger t_audit after insert on board.vote_electorate for each row execute function board.audit_row();

-- Used by the member_votes policy.
create or replace function board.vote_is_closed(p_motion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from board.motions m where m.id = p_motion and m.voting_status = 'closed');
$$;

-- Row level security and grants ----------------------------------------------------------

do $$
declare
  t text;
begin
  -- Records: members read; chair, secretary, owner and admin write.
  foreach t in array array['people', 'positions', 'terms', 'committees', 'committee_members', 'meetings',
    'agenda_items', 'attendance', 'motions', 'minutes', 'documents', 'document_versions', 'packets',
    'action_items', 'meeting_templates'] loop
    execute format('alter table board.%I enable row level security', t);
    execute format('grant select, insert, update, delete on board.%I to authenticated', t);
    execute format('create policy "members read" on board.%I for select to authenticated using (org_id in (select board.readable_org_ids()))', t);
    execute format('create policy "editors insert" on board.%I for insert to authenticated with check (org_id in (select board.editable_org_ids()))', t);
    execute format('create policy "editors update" on board.%I for update to authenticated using (org_id in (select board.editable_org_ids())) with check (org_id in (select board.editable_org_ids()))', t);
    execute format('create policy "editors delete" on board.%I for delete to authenticated using (org_id in (select board.editable_org_ids()))', t);
  end loop;
end $$;

-- An assignee updates their own task (while the org is writable).
create policy "assignee updates own task" on board.action_items for update to authenticated
  using (assignee_id = auth.uid() and public.can_write(org_id, 'board'))
  with check (assignee_id = auth.uid() and public.can_write(org_id, 'board'));

-- Settings, officers and letterhead: owner or admin.
do $$
declare
  t text;
begin
  foreach t in array array['org_settings', 'officers', 'letterheads'] loop
    execute format('alter table board.%I enable row level security', t);
    execute format('grant select, insert, update, delete on board.%I to authenticated', t);
    execute format('create policy "members read" on board.%I for select to authenticated using (org_id in (select board.readable_org_ids()))', t);
    execute format('create policy "managers insert" on board.%I for insert to authenticated with check (org_id in (select board.managed_org_ids()))', t);
    execute format('create policy "managers update" on board.%I for update to authenticated using (org_id in (select board.managed_org_ids())) with check (org_id in (select board.managed_org_ids()))', t);
    execute format('create policy "managers delete" on board.%I for delete to authenticated using (org_id in (select board.managed_org_ids()))', t);
  end loop;
end $$;

-- Votes: read-only to users; written only by the voting functions.
alter table board.vote_electorate enable row level security;
alter table board.member_votes enable row level security;
grant select on board.vote_electorate, board.member_votes to authenticated;
create policy "members read the electorate" on board.vote_electorate for select to authenticated
  using (org_id in (select board.readable_org_ids()));
create policy "own vote, or all votes once closed" on board.member_votes for select to authenticated
  using (org_id in (select board.readable_org_ids()) and (user_id = auth.uid() or board.vote_is_closed(motion_id)));

-- Audit: read-only, chair/secretary/owner/admin.
alter table board.audit_log enable row level security;
grant select on board.audit_log to authenticated;
create policy "officers read audit" on board.audit_log for select to authenticated
  using (org_id in (select board.audit_org_ids()));

grant all on all tables in schema board to service_role;
grant usage on all sequences in schema board to service_role;

-- Live voting ---------------------------------------------------------------------------

create or replace function board.start_vote(p_meeting uuid, p_agenda_item uuid, p_text text, p_moved_by text, p_seconded_by text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m board.meetings;
  v_s board.org_settings;
  v_rule text;
  v_id uuid;
  v_present int;
  v_n int;
  v_unlinked jsonb;
  v_moved text := nullif(btrim(coalesce(p_moved_by, '')), '');
  v_seconded text := nullif(btrim(coalesce(p_seconded_by, '')), '');
begin
  select * into v_m from board.meetings where id = p_meeting for update;
  if v_m.id is null then raise exception 'Meeting not found'; end if;
  if not board.can_edit_records(v_m.org_id) then raise exception 'Not allowed'; end if;
  if v_m.status <> 'in_progress' then raise exception 'Votes can only be opened while the meeting is in progress'; end if;
  if exists (select 1 from board.motions where meeting_id = p_meeting and voting_status = 'open') then
    raise exception 'Another vote is already open — close it first';
  end if;
  if coalesce(btrim(p_text), '') = '' then raise exception 'Motion text is required'; end if;
  v_s := board.settings(v_m.org_id);
  v_rule := v_s.decision_rule;
  if p_agenda_item is not null then
    select coalesce(a.decision_rule, v_s.decision_rule) into v_rule
    from board.agenda_items a where a.id = p_agenda_item and a.meeting_id = p_meeting;
    if v_rule is null then raise exception 'Agenda item belongs to another meeting'; end if;
  end if;
  if v_s.seconder_required and v_seconded is null then
    raise exception 'Your organization requires a seconder before a vote';
  end if;
  if v_moved is not null and v_moved = v_seconded then raise exception 'The same person can''t move and second'; end if;
  select count(*) into v_present from board.attendance
  where meeting_id = p_meeting and status in ('present', 'remote') and is_voting;
  select coalesce(jsonb_agg(person_name order by person_name), '[]') into v_unlinked from board.attendance
  where meeting_id = p_meeting and status in ('present', 'remote') and is_voting and user_id is null;

  perform set_config('app.vote_rpc', 'on', true);
  insert into board.motions (org_id, meeting_id, agenda_item_id, motion_text, moved_by, seconded_by, outcome,
    voting_status, opened_at, opened_by, closes_at, vote_record)
  values (v_m.org_id, p_meeting, p_agenda_item, btrim(p_text), v_moved, v_seconded, 'pending', 'open', now(), auth.uid(),
    case when 'timer' = any (v_s.vote_close_modes) and v_s.vote_timer_minutes is not null
      then now() + make_interval(mins => v_s.vote_timer_minutes) end,
    jsonb_build_object('decision_rule', v_rule, 'org_default_rule', v_s.decision_rule, 'quorum_required', v_s.quorum_count,
      'present_voting', v_present, 'quorum_met', v_present >= v_s.quorum_count, 'seconder_required', v_s.seconder_required,
      'close_modes', to_jsonb(v_s.vote_close_modes), 'present_not_linked', v_unlinked))
  returning id into v_id;

  insert into board.vote_electorate (org_id, motion_id, attendance_id, user_id, person_name)
  select distinct on (a.user_id) v_m.org_id, v_id, a.id, a.user_id, a.person_name
  from board.attendance a
  where a.meeting_id = p_meeting and a.status in ('present', 'remote') and a.is_voting and a.user_id is not null
    and exists (select 1 from public.memberships mm where mm.org_id = v_m.org_id and mm.user_id = a.user_id)
  order by a.user_id, a.created_at;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'No eligible voters: mark voting members present and link them to their accounts on the Attendance tab';
  end if;
  update board.motions set vote_record = vote_record || jsonb_build_object('electorate',
    (select jsonb_agg(person_name order by person_name) from board.vote_electorate where motion_id = v_id))
  where id = v_id;
  perform set_config('app.vote_rpc', 'off', true);
  return v_id;
end $$;

-- Internal: tallies a locked open vote and writes the official record. Not callable by users.
create or replace function board.finish_vote(p_motion uuid, p_how text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mo board.motions;
  v_y int; v_no int; v_a int; v_r int; v_size int;
  v_rule text;
  v_qm boolean;
  v_out board.motion_outcome;
begin
  select * into v_mo from board.motions where id = p_motion;
  select count(*) filter (where vote = 'yes'), count(*) filter (where vote = 'no'),
         count(*) filter (where vote = 'abstain'), count(*) filter (where vote = 'recused')
    into v_y, v_no, v_a, v_r
  from board.member_votes where motion_id = p_motion;
  select count(*) into v_size from board.vote_electorate where motion_id = p_motion;
  v_rule := v_mo.vote_record ->> 'decision_rule';
  v_qm := coalesce((v_mo.vote_record ->> 'quorum_met')::boolean, false);
  v_out := null;
  if v_qm then
    if v_rule = 'majority_cast' and v_y + v_no > 0 then
      v_out := case when v_y > v_no then 'carried' else 'failed' end;
    elsif v_rule = 'majority_present' and v_size - v_r > 0 then
      v_out := case when v_y * 2 > v_size - v_r then 'carried' else 'failed' end;
    elsif v_rule = 'two_thirds_cast' and v_y + v_no > 0 then
      v_out := case when v_y * 3 >= (v_y + v_no) * 2 then 'carried' else 'failed' end;
    end if;
  end if;
  perform set_config('app.vote_rpc', 'on', true);
  update board.motions set
    voting_status = 'closed', closed_at = now(), closed_by = auth.uid(),
    votes_yes = v_y, votes_no = v_no, votes_abstain = v_a, votes_recused = v_r,
    roll_call = (select coalesce(jsonb_agg(jsonb_build_object('attendance_id', attendance_id, 'person_name', person_name, 'vote', vote)
      order by person_name), '[]') from board.member_votes where motion_id = p_motion),
    outcome = coalesce(v_out, 'pending'),
    disposition_source = case when v_out is null then null else 'calculated' end,
    disposition_at = case when v_out is null then null else now() end,
    vote_record = vote_record || jsonb_build_object(
      'votes_yes', v_y, 'votes_no', v_no, 'votes_abstain', v_a, 'votes_recused', v_r, 'electorate_size', v_size,
      'recused', (select coalesce(jsonb_agg(person_name order by person_name), '[]') from board.member_votes
        where motion_id = p_motion and vote = 'recused'),
      'not_voting', (select coalesce(jsonb_agg(e.person_name order by e.person_name), '[]') from board.vote_electorate e
        where e.motion_id = p_motion and not exists (
          select 1 from board.member_votes v where v.motion_id = p_motion and v.user_id = e.user_id)),
      'closed_how', p_how, 'calculated', v_out is not null,
      'needs_disposition_reason', case
        when v_out is not null then null
        when not v_qm then 'Quorum was not met when the vote opened'
        when v_rule = 'chair' then 'Your decision rule leaves the result to the chair'
        else 'No votes were cast for or against' end)
  where id = p_motion;
  perform set_config('app.vote_rpc', 'off', true);
end $$;

create or replace function board.cast_vote(p_motion uuid, p_vote text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mo board.motions;
  v_status board.meeting_status;
  v_e board.vote_electorate;
  v_n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_vote not in ('yes', 'no', 'abstain', 'recused') then raise exception 'Invalid vote'; end if;
  select * into v_mo from board.motions where id = p_motion for update;
  if v_mo.id is null or not public.is_member(v_mo.org_id) then raise exception 'Vote not found'; end if;
  if not public.can_write(v_mo.org_id, 'board') then
    raise exception 'Board is read-only for this organization, so votes can''t be recorded';
  end if;
  if v_mo.voting_status <> 'open' then raise exception 'This vote is closed'; end if;
  select status into v_status from board.meetings where id = v_mo.meeting_id;
  if v_status <> 'in_progress' then raise exception 'Votes are only accepted while the meeting is in progress'; end if;
  if v_mo.closes_at is not null and now() >= v_mo.closes_at then
    perform board.finish_vote(p_motion, 'timer');
    return 'expired';
  end if;
  select * into v_e from board.vote_electorate where motion_id = p_motion and user_id = auth.uid();
  if v_e.id is null then
    raise exception 'You are not on the voter list for this motion (only voting members present when it opened can vote)';
  end if;
  insert into board.member_votes (org_id, motion_id, attendance_id, user_id, person_name, vote)
  values (v_mo.org_id, p_motion, v_e.attendance_id, auth.uid(), v_e.person_name, p_vote)
  on conflict (motion_id, user_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'You have already voted on this motion'; end if;
  if 'auto' = any ((board.settings(v_mo.org_id)).vote_close_modes)
     and (select count(*) from board.member_votes where motion_id = p_motion)
         >= (select count(*) from board.vote_electorate where motion_id = p_motion) then
    perform board.finish_vote(p_motion, 'all_voted');
  end if;
  return 'recorded';
end $$;

create or replace function board.close_vote(p_motion uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mo board.motions;
  v_s board.org_settings;
begin
  select * into v_mo from board.motions where id = p_motion for update;
  if v_mo.id is null or not public.is_member(v_mo.org_id) then raise exception 'Vote not found'; end if;
  if v_mo.voting_status <> 'open' then raise exception 'This vote is already closed'; end if;
  if not public.can_write(v_mo.org_id, 'board') then raise exception 'Board is read-only for this organization'; end if;
  v_s := board.settings(v_mo.org_id);
  if v_mo.closes_at is not null and now() >= v_mo.closes_at then
    perform board.finish_vote(p_motion, 'timer');
    return;
  end if;
  if not ('chair' = any (v_s.vote_close_modes)) then
    raise exception 'Your organization''s settings don''t allow closing a vote early';
  end if;
  if not board.holds_any(v_mo.org_id, v_s.vote_closer_roles) then raise exception 'Your role can''t close votes'; end if;
  perform board.finish_vote(p_motion, 'chair');
end $$;

create or replace function board.vote_progress(p_motion uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from board.motions where id = p_motion;
  if v_org is null or not public.is_member(v_org) then raise exception 'Vote not found'; end if;
  return jsonb_build_object(
    'cast', (select count(*) from board.member_votes where motion_id = p_motion),
    'electorate', (select count(*) from board.vote_electorate where motion_id = p_motion));
end $$;

create or replace function board.record_disposition(p_motion uuid, p_outcome board.motion_outcome, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mo board.motions;
  v_s board.org_settings;
begin
  select * into v_mo from board.motions where id = p_motion for update;
  if v_mo.id is null or not public.is_member(v_mo.org_id) then raise exception 'Vote not found'; end if;
  if v_mo.voting_status <> 'closed' then raise exception 'Close the vote before recording its result'; end if;
  if not public.can_write(v_mo.org_id, 'board') then raise exception 'Board is read-only for this organization'; end if;
  v_s := board.settings(v_mo.org_id);
  if not board.holds_any(v_mo.org_id, v_s.vote_closer_roles) then raise exception 'Your role can''t record vote results'; end if;
  if p_outcome = 'pending' then raise exception 'Choose a result'; end if;
  if length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'An explanation is required'; end if;
  if v_mo.disposition_source = 'calculated' and p_outcome not in ('tabled', 'withdrawn') then
    raise exception 'The result was calculated from the decision rule; it can only be changed to tabled or withdrawn';
  end if;
  perform set_config('app.vote_rpc', 'on', true);
  update board.motions set
    outcome = p_outcome, disposition_source = 'recorded', disposition_note = btrim(p_note),
    disposition_by = auth.uid(), disposition_at = now(),
    vote_record = vote_record || jsonb_build_object('disposition_history',
      coalesce(vote_record -> 'disposition_history', '[]') || jsonb_build_array(jsonb_build_object(
        'from', v_mo.outcome, 'to', p_outcome, 'note', btrim(p_note), 'by', auth.uid(), 'at', now())))
  where id = p_motion;
  perform set_config('app.vote_rpc', 'off', true);
end $$;

-- Invitations (spec §4.3): after public.accept_invitation, an invitation made in
-- Board can carry an office: app = 'board', app_payload = {"office": "secretary"}.
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
begin
  select * into v_inv from public.invitations where id = p_invitation_id;
  if v_inv.id is null or v_inv.accepted_by is distinct from auth.uid() then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
  if v_inv.app is distinct from 'board' then return; end if;
  v_office := v_inv.app_payload ->> 'office';
  if v_office is null then return; end if;
  if v_office not in ('chair', 'secretary', 'treasurer') then
    raise exception 'Unknown office %', v_office using errcode = '22023';
  end if;
  if v_inv.role is null or v_inv.role not in ('admin', 'member') then
    raise exception 'An office needs a member role' using errcode = '22023';
  end if;
  insert into board.officers (org_id, user_id, office)
  values (v_inv.org_id, auth.uid(), v_office::board.office)
  on conflict (org_id, user_id) do update set office = excluded.office;
end $$;

revoke all on all functions in schema board from public, anon;
revoke execute on function board.finish_vote(uuid, text) from authenticated;
grant execute on function
  board.org_gone(uuid),
  board.readable_org_ids(),
  board.editable_org_ids(),
  board.managed_org_ids(),
  board.audit_org_ids(),
  board.settings(uuid),
  board.my_office(uuid),
  board.can_manage(uuid),
  board.can_edit_records(uuid),
  board.can_read_audit(uuid),
  board.holds_any(uuid, text[]),
  board.vote_is_closed(uuid),
  board.start_vote(uuid, uuid, text, text, text),
  board.cast_vote(uuid, text),
  board.close_vote(uuid),
  board.vote_progress(uuid),
  board.record_disposition(uuid, board.motion_outcome, text),
  board.on_invitation_accepted(uuid)
to authenticated;

-- Storage (spec §3.7): private bucket board-files, paths <org_id>/… Skipped on a
-- database without Supabase Storage.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'No storage schema: skipping the board-files bucket and its policies';
    return;
  end if;
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('board-files', 'board-files', false)
    on conflict (id) do nothing;
  end if;
  create policy "board members read files" on storage.objects for select to authenticated
    using (bucket_id = 'board-files' and public.is_member(((storage.foldername(name))[1])::uuid));
  create policy "board editors upload files" on storage.objects for insert to authenticated
    with check (bucket_id = 'board-files' and board.can_edit_records(((storage.foldername(name))[1])::uuid));
  create policy "board letterhead uploads require managers" on storage.objects as restrictive for insert to authenticated
    with check (bucket_id <> 'board-files' or split_part(name, '/', 2) <> 'letterhead'
      or board.can_manage(split_part(name, '/', 1)::uuid));
end $$;
