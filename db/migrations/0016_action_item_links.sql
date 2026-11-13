-- C-08 (core 0014, owner decisions 2026-11-13): an action item's reminder email says it's waiting
-- for the person and, when the organization allows "Mark action items done from email"
-- (Organization settings, Actions from email; off until switched on), has a Mark it done button.
-- The confirm page calls board.complete_action_item as the signed-in person, so the app's own
-- rules decide, as on the Tasks page.

do $$
begin
  if to_regprocedure('public.register_email_action_kind(text,text,text,text,integer)') is not null then
    perform public.register_email_action_kind('board_action_items', 'board', 'Mark action items done from email',
      'An action item''s reminder email has a "Mark it done" button.', 30);
  end if;
end $$;

create or replace function board.queue_email_reminders()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  r record;
begin
  -- Meetings: days until the meeting, in the organization's time zone. A meeting is reminded at
  -- the nearest chosen day not yet passed (so a meeting scheduled 5 days ahead still gets the
  -- "7 days" one), once per chosen day.
  for r in
    with settings as (
      select o.id as org_id, coalesce(s.timezone, o.time_zone, 'UTC') as tz, a.enabled,
             array(select (jsonb_array_elements_text(a.params->'days_before'))::int) as offsets
      from public.organizations o
      left join board.org_settings s on s.org_id = o.id
      cross join lateral public.automation_settings(o.id, 'board.meeting_reminders') a
    ), due as (
      select m.id, m.org_id, m.title, m.meeting_date, m.start_time, m.location,
             m.meeting_date - (now() at time zone st.tz)::date as days, st.offsets
      from board.meetings m
      join settings st on st.org_id = m.org_id and st.enabled
      where m.status = 'scheduled'
        and m.meeting_date between current_date - 1 and current_date + 61
    ), at_offset as (
      select d.*, (select min(o) from unnest(d.offsets) o where o >= d.days) as offset_day
      from due d
      where d.days >= 0
    ), recipients as (
      select distinct a.id, a.org_id, a.title, a.meeting_date, a.start_time, a.location, a.days,
             a.offset_day, t.user_id
      from at_offset a
      join board.terms t on t.org_id = a.org_id and t.user_id is not null
       and t.start_date <= a.meeting_date
       and (t.end_date is null or t.end_date >= a.meeting_date)
      where a.offset_day is not null
    ), sent as (
      select rc.org_id, public.enqueue_email(
        'board', 'board.meeting_reminder', rc.org_id, rc.user_id, null,
        jsonb_build_object(
          'title', rc.title, 'meeting_date', rc.meeting_date, 'start_time', rc.start_time,
          'location', rc.location, 'days', rc.days,
          'link', format('/board/meetings/%s?org=%s', rc.id, rc.org_id)),
        'reminders',
        format('board.meeting:%s:%s:%sd:%s', rc.id, rc.meeting_date, rc.offset_day, rc.user_id)) as email_id
      from recipients rc
    )
    select org_id, count(email_id)::int as n from sent group by org_id
  loop
    perform public.log_automation(r.org_id, 'board.meeting_reminders', r.n,
      format('%s meeting %s emailed', r.n, case when r.n = 1 then 'reminder' else 'reminders' end));
    v_count := v_count + r.n;
  end loop;

  -- Action items.
  for r in
    with settings as (
      select o.id as org_id, coalesce(s.timezone, o.time_zone, 'UTC') as tz, a.enabled,
             coalesce((a.params->>'days_before')::int, 2) as days_before,
             coalesce((a.params->>'when_overdue')::boolean, true) as when_overdue
      from public.organizations o
      left join board.org_settings s on s.org_id = o.id
      cross join lateral public.automation_settings(o.id, 'board.action_item_reminders') a
    ), items as (
      select a.id, a.org_id, a.title, a.due_date, a.assignee_id, mt.title as meeting_title,
             a.due_date - (now() at time zone st.tz)::date as days, st.days_before, st.when_overdue
      from board.action_items a
      join settings st on st.org_id = a.org_id and st.enabled
      left join board.meetings mt on mt.id = a.meeting_id
      where a.status in ('open', 'in_progress')
        and a.assignee_id is not null
        and a.due_date between current_date - 8 and current_date + 31
    ), sent as (
      select i.org_id, public.enqueue_email(
        'board', 'board.action_item_due', i.org_id, i.assignee_id, null,
        jsonb_build_object(
          'title', i.title, 'due_date', i.due_date, 'meeting_title', i.meeting_title,
          'overdue', i.days < 0, 'link', format('/board/tasks?org=%s', i.org_id),
          -- C-08: "Mark it done", when the organization allows it from email (core 0014).
          'actions', case when to_regprocedure('public.action_links_for(uuid,uuid,text,text,jsonb,text,text)') is not null
            then public.action_links_for(i.org_id, i.assignee_id, 'board_action_items', format('Action item: %s', i.title),
              jsonb_build_array(jsonb_build_object('label', 'Mark it done', 'schema', 'board', 'fn', 'complete_action_item',
                'args', jsonb_build_object('p_id', i.id))),
              format('/board/tasks?org=%s', i.org_id), 'board')
            else '[]'::jsonb end),
        'reminders',
        format('board.action:%s:%s:%s', i.id, i.due_date, case when i.days < 0 then 'overdue' else 'due' end)) as email_id
      from items i
      where (i.days between 0 and i.days_before
             or (i.when_overdue and i.days between -7 and -1))
        -- Already queued: nothing to send (and no links made for nothing).
        and not exists (select 1 from public.email_outbox ob where ob.dedupe_key =
          format('board.action:%s:%s:%s', i.id, i.due_date, case when i.days < 0 then 'overdue' else 'due' end))
    )
    select org_id, count(email_id)::int as n from sent group by org_id
  loop
    perform public.log_automation(r.org_id, 'board.action_item_reminders', r.n,
      format('%s action item %s emailed', r.n, case when r.n = 1 then 'reminder' else 'reminders' end));
    v_count := v_count + r.n;
  end loop;

  -- count() skips nulls, and enqueue_email returns null for an email already queued:
  -- v_count is the number of new emails.
  return v_count;
end;
$$;

revoke all on function board.queue_email_reminders() from public, anon, authenticated;
grant execute on function board.queue_email_reminders() to service_role;
