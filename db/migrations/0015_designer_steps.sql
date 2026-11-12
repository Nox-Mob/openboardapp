-- Steps OpenBoardApp offers the workflow designer (core 0012, S-28). They run as the
-- organization (owner decision 2026-11-12), inside it only.
--
--   board.find_meetings      (lookup) meetings in a window of days, e.g. the next 30
--   board.find_action_items  (lookup) action items: open, overdue, done or any
--   board.create_action_item (call)   a new action item, assigned to someone (by account or email)

create or replace function board.wf_find_meetings(p_org uuid, p_params jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select mt.id, mt.title, mt.meeting_date, mt.start_time, mt.location, mt.status::text as status
    from board.meetings mt
    where mt.org_id = p_org
      and mt.meeting_date between current_date + coalesce(nullif(p_params ->> 'from_days', '')::int, 0)
                              and current_date + coalesce(nullif(p_params ->> 'to_days', '')::int, 30)
      and (coalesce(nullif(p_params ->> 'status', ''), 'scheduled') = 'any'
           or mt.status::text = coalesce(nullif(p_params ->> 'status', ''), 'scheduled'))
    order by mt.meeting_date, mt.start_time nulls last
    limit least(greatest(coalesce(nullif(p_params ->> 'limit', '')::int, 100), 1), 1000)
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'date', m.meeting_date,
      'start_time', m.start_time, 'location', m.location, 'status', m.status,
      'days_away', m.meeting_date - current_date, 'link', format('/board/meetings/%s', m.id)) order by m.meeting_date), '[]'),
    'count', count(*),
    'summary', format('%s %s found', count(*), case when count(*) = 1 then 'meeting' else 'meetings' end))
  from m;
$$;

create or replace function board.wf_find_action_items(p_org uuid, p_params jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with a as (
    select ai.id, ai.title, ai.due_date, ai.status::text as status, ai.assignee_id,
           coalesce(nullif(pr.display_name, ''), u.email::text, '') as assignee_name, u.email::text as assignee_email,
           mt.title as meeting_title
    from board.action_items ai
    left join auth.users u on u.id = ai.assignee_id
    left join public.profiles pr on pr.id = ai.assignee_id
    left join board.meetings mt on mt.id = ai.meeting_id
    where ai.org_id = p_org
      and case coalesce(nullif(p_params ->> 'status', ''), 'open')
            when 'open' then ai.status in ('open', 'in_progress')
            when 'overdue' then ai.status in ('open', 'in_progress') and ai.due_date < current_date
            when 'done' then ai.status = 'done'
            else true end
      and (nullif(p_params ->> 'due_within_days', '') is null
           or ai.due_date between current_date and current_date + (p_params ->> 'due_within_days')::int)
    order by ai.due_date nulls last, ai.created_at
    limit least(greatest(coalesce(nullif(p_params ->> 'limit', '')::int, 500), 1), 5000)
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'due_date', a.due_date, 'status', a.status,
      'user_id', a.assignee_id, 'assignee_name', a.assignee_name, 'email', a.assignee_email, 'meeting_title', a.meeting_title,
      'days_overdue', case when a.due_date < current_date then current_date - a.due_date end)), '[]'),
    'count', count(*),
    'summary', format('%s action %s found', count(*), case when count(*) = 1 then 'item' else 'items' end))
  from a;
$$;

create or replace function board.wf_create_action_item(p_org uuid, p_params jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignee uuid;
  v_id uuid;
  v_meeting uuid;
begin
  if coalesce(btrim(p_params ->> 'title'), '') = '' then
    raise exception 'The action item needs a title.' using errcode = '22023';
  end if;
  if p_params ->> 'assignee_id' ~ '^[0-9a-f-]{36}$' then
    select m.user_id into v_assignee from public.memberships m where m.org_id = p_org and m.user_id = (p_params ->> 'assignee_id')::uuid;
  elsif coalesce(p_params ->> 'assignee_email', '') <> '' then
    select m.user_id into v_assignee from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email::text) = lower(btrim(p_params ->> 'assignee_email')) limit 1;
  end if;
  if p_params ->> 'meeting_id' ~ '^[0-9a-f-]{36}$' then
    select id into v_meeting from board.meetings where id = (p_params ->> 'meeting_id')::uuid and org_id = p_org;
  end if;
  insert into board.action_items (org_id, meeting_id, title, details, assignee_id, due_date, created_by)
  values (p_org, v_meeting, btrim(p_params ->> 'title'), nullif(p_params ->> 'details', ''), v_assignee,
          nullif(p_params ->> 'due_date', '')::date, null)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'title', btrim(p_params ->> 'title'), 'assigned', v_assignee is not null,
    'summary', format('Action item "%s" created%s', btrim(p_params ->> 'title'), case when v_assignee is null then ' (nobody assigned)' else '' end));
end;
$$;

revoke all on function board.wf_find_meetings(uuid, jsonb), board.wf_find_action_items(uuid, jsonb),
  board.wf_create_action_item(uuid, jsonb) from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.register_automation_step(text,text,text,text,text,text,jsonb,jsonb,text[],integer)') is not null then
    perform public.register_automation_step('board.find_meetings', 'board', 'Find board meetings',
      'Look up meetings in a window of days (for example the next 30), to use in later steps.', 'query', 'board.wf_find_meetings',
      '{"from_days": {"type": "int", "label": "From (days from today; negative for the past)", "min": -3650, "max": 3650, "optional": true},
        "to_days": {"type": "int", "label": "To (days from today)", "min": -3650, "max": 3650, "optional": true},
        "status": {"type": "choice", "label": "Status", "options": ["scheduled", "draft", "completed", "any"]},
        "limit": {"type": "int", "label": "At most", "min": 1, "max": 1000, "optional": true}}',
      '[{"key": "rows", "label": "Meetings", "type": "list", "fields": [
          {"key": "id", "label": "Meeting", "type": "text"}, {"key": "title", "label": "Title", "type": "text"},
          {"key": "date", "label": "Date", "type": "date"}, {"key": "start_time", "label": "Start time", "type": "text"},
          {"key": "location", "label": "Location", "type": "text"}, {"key": "days_away", "label": "Days away", "type": "number"}]},
        {"key": "count", "label": "How many", "type": "number"}]', '{}', 5);
    perform public.register_automation_step('board.find_action_items', 'board', 'Find action items',
      'Look up action items (open, overdue, done or any) with who they''re assigned to.', 'query', 'board.wf_find_action_items',
      '{"status": {"type": "choice", "label": "Which", "options": ["open", "overdue", "done", "any"]},
        "due_within_days": {"type": "int", "label": "Due within (days, optional)", "min": 0, "max": 365, "optional": true},
        "limit": {"type": "int", "label": "At most", "min": 1, "max": 5000, "optional": true}}',
      '[{"key": "rows", "label": "Action items", "type": "list", "fields": [
          {"key": "title", "label": "Title", "type": "text"}, {"key": "due_date", "label": "Due", "type": "date"},
          {"key": "status", "label": "Status", "type": "text"}, {"key": "assignee_name", "label": "Assigned to", "type": "text"},
          {"key": "email", "label": "Their email", "type": "text"}, {"key": "user_id", "label": "Their account", "type": "text"},
          {"key": "days_overdue", "label": "Days overdue", "type": "number"}, {"key": "meeting_title", "label": "Meeting", "type": "text"}]},
        {"key": "count", "label": "How many", "type": "number"}]', '{}', 6);
    perform public.register_automation_step('board.create_action_item', 'board', 'Create an action item',
      'Add an action item, assigned to someone by their account or email.', 'call', 'board.wf_create_action_item',
      '{"title": {"type": "text", "label": "Title"},
        "details": {"type": "text", "label": "Details (optional)", "optional": true},
        "assignee_email": {"type": "text", "label": "Assign to (email, optional)", "optional": true},
        "due_date": {"type": "date", "label": "Due (optional)", "optional": true},
        "meeting_id": {"type": "text", "label": "Meeting (optional)", "optional": true}}',
      '[{"key": "id", "label": "Action item", "type": "text"}, {"key": "assigned", "label": "Assigned", "type": "boolean"}]', '{}', 7);
  end if;
end $$;
