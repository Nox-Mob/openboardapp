-- B-09: email reminders for board meetings and action items (S-16).
-- Needs core 0005 (the email outbox, vendored in db/core).
--
-- board.queue_email_reminders() runs every 15 minutes (public.email_jobs; the hub's
-- sender runs it when hosted, the app's own sender when self-hosted). It queues:
--   - each current board member (a term with an account), 7 days and 1 day before a
--     scheduled meeting
--   - the person an open action item is assigned to, 2 days before it's due, and once
--     when it becomes overdue (items more than a week overdue are left alone)
-- Every email has a de-duplication key, so running the job again queues nothing new;
-- moving a meeting or a due date makes a new reminder.

create or replace function board.queue_email_reminders()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_n int;
begin
  -- Meetings: days until the meeting, in the organization's time zone.
  with due as (
    select m.id, m.org_id, m.title, m.meeting_date, m.start_time, m.location,
           m.meeting_date - (now() at time zone coalesce(s.timezone, o.time_zone, 'UTC'))::date as days
    from board.meetings m
    join public.organizations o on o.id = m.org_id
    left join board.org_settings s on s.org_id = m.org_id
    where m.status = 'scheduled'
      and m.meeting_date between current_date - 1 and current_date + 8
  ), recipients as (
    select distinct d.*, t.user_id
    from due d
    join board.terms t on t.org_id = d.org_id and t.user_id is not null
     and t.start_date <= d.meeting_date
     and (t.end_date is null or t.end_date >= d.meeting_date)
    where d.days between 0 and 7
  )
  select count(public.enqueue_email(
    'board', 'board.meeting_reminder', r.org_id, r.user_id, null,
    jsonb_build_object(
      'title', r.title, 'meeting_date', r.meeting_date, 'start_time', r.start_time,
      'location', r.location, 'days', r.days,
      'link', format('/board/meetings/%s?org=%s', r.id, r.org_id)),
    'reminders',
    format('board.meeting:%s:%s:%s:%s', r.id, r.meeting_date,
      case when r.days <= 1 then '1d' else '7d' end, r.user_id)))
  into v_n
  from recipients r;
  v_count := v_count + coalesce(v_n, 0);

  -- Action items.
  with items as (
    select a.id, a.org_id, a.title, a.due_date, a.assignee_id, mt.title as meeting_title,
           a.due_date - (now() at time zone coalesce(s.timezone, o.time_zone, 'UTC'))::date as days
    from board.action_items a
    join public.organizations o on o.id = a.org_id
    left join board.org_settings s on s.org_id = a.org_id
    left join board.meetings mt on mt.id = a.meeting_id
    where a.status in ('open', 'in_progress')
      and a.assignee_id is not null
      and a.due_date between current_date - 8 and current_date + 3
  )
  select count(public.enqueue_email(
    'board', 'board.action_item_due', i.org_id, i.assignee_id, null,
    jsonb_build_object(
      'title', i.title, 'due_date', i.due_date, 'meeting_title', i.meeting_title,
      'overdue', i.days < 0, 'link', format('/board/tasks?org=%s', i.org_id)),
    'reminders',
    format('board.action:%s:%s:%s', i.id, i.due_date, case when i.days < 0 then 'overdue' else 'due' end)))
  into v_n
  from items i
  where i.days between -7 and 2;
  v_count := v_count + coalesce(v_n, 0);

  -- count() skips nulls, and enqueue_email returns null for an email already queued:
  -- v_count is the number of new emails.
  return v_count;
end;
$$;

revoke all on function board.queue_email_reminders() from public, anon, authenticated;
grant execute on function board.queue_email_reminders() to service_role;

insert into public.email_jobs (name, fn, every)
values ('board.reminders', 'board.queue_email_reminders', interval '15 minutes')
on conflict (name) do update set fn = excluded.fn, every = excluded.every;
