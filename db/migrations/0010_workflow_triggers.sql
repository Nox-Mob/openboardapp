-- S-25 part 2: what can start an organization's workflows in OpenBoardApp (core 0009).
--   board.meeting_upcoming     a scheduled meeting is N days away or less (once per meeting date)
--   board.meeting_scheduled    a meeting is scheduled (an event, as it happens)
--   board.action_item_overdue  an open action item is N days past due (once per due date)
-- Each gives its workflow the meeting or item (and a link to it); meeting triggers also let a
-- workflow put documents into that meeting (actions that need a meeting, like OpenLedgerApp's
-- reports).

create or replace function board._wf_meeting_ctx(p_meeting board.meetings, p_days int)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'meeting', jsonb_build_object('id', p_meeting.id, 'title', p_meeting.title, 'date', p_meeting.meeting_date,
      'start_time', coalesce(p_meeting.start_time, ''), 'location', coalesce(p_meeting.location, ''), 'days_away', p_days),
    'link', format('/board/meetings/%s?org=%s', p_meeting.id, p_meeting.org_id), 'link_app', 'board',
    'summary', format('%s, %s', p_meeting.title, to_char(p_meeting.meeting_date, 'Mon DD, YYYY')));
$$;

create or replace function board.wf_meeting_upcoming(p_org uuid, p_params jsonb)
returns table (dedupe text, ctx jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select (now() at time zone coalesce(s.timezone, o.time_zone, 'UTC'))::date as d
    from public.organizations o left join board.org_settings s on s.org_id = o.id where o.id = p_org
  )
  select format('meeting:%s:%s', m.id, m.meeting_date), board._wf_meeting_ctx(m, m.meeting_date - t.d)
  from board.meetings m, today t
  where m.org_id = p_org and m.status = 'scheduled'
    and m.meeting_date - t.d between 0 and coalesce((p_params->>'days_before')::int, 5);
$$;

create or replace function board.wf_action_item_overdue(p_org uuid, p_params jsonb)
returns table (dedupe text, ctx jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select (now() at time zone coalesce(s.timezone, o.time_zone, 'UTC'))::date as d
    from public.organizations o left join board.org_settings s on s.org_id = o.id where o.id = p_org
  )
  select format('item:%s:%s', a.id, a.due_date),
    jsonb_build_object(
      'item', jsonb_build_object('title', a.title, 'due_date', a.due_date, 'days_overdue', t.d - a.due_date,
        'assignee', coalesce((select p.display_name from public.profiles p where p.id = a.assignee_id), '')),
      'subject_user_id', a.assignee_id,
      'link', format('/board/tasks?org=%s', a.org_id), 'link_app', 'board',
      'summary', format('%s (due %s)', a.title, to_char(a.due_date, 'Mon DD')))
  from board.action_items a, today t
  where a.org_id = p_org and a.status in ('open', 'in_progress') and a.due_date is not null
    and t.d - a.due_date between coalesce((p_params->>'days_overdue')::int, 1) and coalesce((p_params->>'days_overdue')::int, 1) + 7;
$$;

create or replace function board._wf_meeting_scheduled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'scheduled' and (tg_op = 'INSERT' or old.status is distinct from 'scheduled') then
    perform public.emit_automation_event(new.org_id, 'board.meeting_scheduled',
      board._wf_meeting_ctx(new, new.meeting_date - current_date));
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_wf_scheduled on board.meetings;
create trigger meetings_wf_scheduled after insert or update of status on board.meetings
  for each row execute function board._wf_meeting_scheduled();

revoke all on function board.wf_meeting_upcoming(uuid, jsonb), board.wf_action_item_overdue(uuid, jsonb),
  board._wf_meeting_ctx(board.meetings, int), board._wf_meeting_scheduled() from public, anon, authenticated;
grant execute on function board.wf_meeting_upcoming(uuid, jsonb), board.wf_action_item_overdue(uuid, jsonb) to service_role;

select public.register_automation_trigger(
  'board.meeting_upcoming', 'board', 'A board meeting is coming up',
  'When a scheduled meeting is this many days away or less. Runs once per meeting (again if it moves to a new date).',
  'scan', 'board.wf_meeting_upcoming',
  '{"days_before": {"type": "int", "label": "Days before the meeting", "min": 0, "max": 60}}',
  '[{"key": "meeting.title", "label": "Meeting title", "type": "text"},
    {"key": "meeting.date", "label": "Meeting date", "type": "date"},
    {"key": "meeting.start_time", "label": "Start time", "type": "text"},
    {"key": "meeting.location", "label": "Location", "type": "text"},
    {"key": "meeting.days_away", "label": "Days away", "type": "number"}]',
  null, '{meeting}', 20);

select public.register_automation_trigger(
  'board.meeting_scheduled', 'board', 'A board meeting is scheduled',
  'As soon as a meeting is scheduled.',
  'event', null, '{}',
  '[{"key": "meeting.title", "label": "Meeting title", "type": "text"},
    {"key": "meeting.date", "label": "Meeting date", "type": "date"},
    {"key": "meeting.location", "label": "Location", "type": "text"},
    {"key": "meeting.days_away", "label": "Days away", "type": "number"}]',
  null, '{meeting}', 21);

select public.register_automation_trigger(
  'board.action_item_overdue', 'board', 'An action item is overdue',
  'When an open action item is this many days past its due date. Runs once per item and due date.',
  'scan', 'board.wf_action_item_overdue',
  '{"days_overdue": {"type": "int", "label": "Days past due", "min": 0, "max": 60}}',
  '[{"key": "item.title", "label": "Action item", "type": "text"},
    {"key": "item.due_date", "label": "Due date", "type": "date"},
    {"key": "item.days_overdue", "label": "Days overdue", "type": "number"},
    {"key": "item.assignee", "label": "Assigned to", "type": "text"}]',
  null, '{}', 22);

-- Workflows add reports to meetings from an app's server (OpenLedgerApp's
-- ledger.reports_to_meeting action), with the service role.
grant execute on function board.add_report_to_meeting(uuid, text, text, text) to service_role;

-- Who a workflow can send to in OpenBoardApp: the people holding an office.
create or replace function board.wf_office_holders(p_org uuid, p_params jsonb, p_ctx jsonb)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.user_id, null::text from board.officers o where o.org_id = p_org and o.office::text = p_params->>'office';
$$;
revoke all on function board.wf_office_holders(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function board.wf_office_holders(uuid, jsonb, jsonb) to service_role;

select public.register_automation_recipient(
  'board.office', 'board', 'An officer of the board',
  'Whoever holds an office in OpenBoardApp: the chair, the secretary or the treasurer.',
  '{"office": {"type": "choice", "label": "Office", "options": ["chair", "secretary", "treasurer"]}}',
  'board.wf_office_holders', 10);
