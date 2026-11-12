-- B-11: multi-step changes happen in one database call, so a failure part-way leaves nothing
-- half-done. Each function runs as the caller (security invoker): the same row-level security,
-- locks and triggers apply as when the app wrote the rows one by one.
--
--   board.create_meeting_with_agenda  a meeting and its starting agenda
--   board.assign_term                 end the role's open terms the day before, start the new one
--   board.add_document                a document and its first file version (the file is
--                                     uploaded first; the app removes it if this call fails)

create or replace function board.create_meeting_with_agenda(
  p_org uuid,
  p_title text,
  p_meeting_date date,
  p_start_time text default null,
  p_location text default null,
  p_agenda jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into board.meetings (org_id, title, meeting_date, start_time, location, status)
  values (p_org, p_title, p_meeting_date, nullif(btrim(p_start_time), ''), nullif(btrim(p_location), ''), 'scheduled')
  returning id into v_id;

  insert into board.agenda_items
    (org_id, meeting_id, position, title, presenter, duration_minutes, description, proposed_motion,
     is_vote_item, decision_rule)
  select p_org, v_id, (row_number() over (order by a.ord) - 1)::int, btrim(a.item->>'title'),
         nullif(btrim(a.item->>'presenter'), ''),
         case when jsonb_typeof(a.item->'duration_minutes') = 'number' then (a.item->>'duration_minutes')::int end,
         nullif(btrim(a.item->>'description'), ''),
         nullif(btrim(a.item->>'proposed_motion'), ''),
         coalesce((a.item->>'is_vote_item')::boolean, false),
         nullif(btrim(a.item->>'decision_rule'), '')
  from jsonb_array_elements(coalesce(p_agenda, '[]'::jsonb)) with ordinality a(item, ord)
  where coalesce(btrim(a.item->>'title'), '') <> '';

  return v_id;
end;
$$;

create or replace function board.assign_term(
  p_org uuid,
  p_position_id uuid,
  p_position text,
  p_person_name text,
  p_user_id uuid,
  p_start_date date,
  p_end_date date default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'The term can''t end before it starts.' using errcode = '22023';
  end if;
  -- Open terms for this role end the day before; history is kept.
  update board.terms
  set end_date = p_start_date - 1
  where org_id = p_org and position_id = p_position_id
    and start_date < p_start_date
    and (end_date is null or end_date >= p_start_date);

  insert into board.terms (org_id, position_id, position, person_name, user_id, start_date, end_date)
  values (p_org, p_position_id, p_position, p_person_name, p_user_id, p_start_date, p_end_date)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function board.add_document(
  p_id uuid,
  p_org uuid,
  p_title text,
  p_category text,
  p_meeting_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  insert into board.documents (id, org_id, title, category, meeting_id)
  values (p_id, p_org, p_title, coalesce(nullif(btrim(p_category), ''), 'General'), p_meeting_id);
  insert into board.document_versions (org_id, document_id, version, storage_path, file_name, mime_type, size_bytes)
  values (p_org, p_id, 1, p_storage_path, p_file_name, nullif(p_mime_type, ''), p_size_bytes);
  return p_id;
end;
$$;

revoke all on function board.create_meeting_with_agenda(uuid, text, date, text, text, jsonb),
  board.assign_term(uuid, uuid, text, text, uuid, date, date),
  board.add_document(uuid, uuid, text, text, uuid, text, text, text, bigint)
from public, anon;
grant execute on function board.create_meeting_with_agenda(uuid, text, date, text, text, jsonb),
  board.assign_term(uuid, uuid, text, text, uuid, date, date),
  board.add_document(uuid, uuid, text, text, uuid, text, text, text, bigint)
to authenticated, service_role;
