create table public.meeting_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  meeting_title text not null default 'Regular Board Meeting',
  start_time text,
  location text,
  agenda jsonb not null default '[]'::jsonb check (jsonb_typeof(agenda) = 'array'),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index meeting_templates_org_idx on public.meeting_templates(organization_id);
grant select, insert, update, delete on public.meeting_templates to authenticated;
grant all on public.meeting_templates to service_role;
alter table public.meeting_templates enable row level security;
create policy "members read" on public.meeting_templates for select to authenticated using (public.is_org_member(organization_id));
create policy "editors insert" on public.meeting_templates for insert to authenticated with check (public.can_edit_records(organization_id));
create policy "editors update" on public.meeting_templates for update to authenticated using (public.can_edit_records(organization_id)) with check (public.can_edit_records(organization_id));
create policy "editors delete" on public.meeting_templates for delete to authenticated using (public.can_edit_records(organization_id));
create trigger t_audit after insert or update or delete on public.meeting_templates for each row execute function public.audit_row();