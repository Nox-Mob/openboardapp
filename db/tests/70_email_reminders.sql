-- B-09 reminders (S-16): who gets which reminder, once.
begin;
do $$
declare
  alice uuid := tests.create_user('alice@remind.org', '{"full_name":"Alice"}');
  bob uuid := tests.create_user('bob@remind.org', '{"full_name":"Bob"}');
  carol uuid := tests.create_user('carol@remind.org', '{"full_name":"Carol"}');
  org uuid; soon uuid; next_week uuid; far uuid;
  n int;
begin
  perform tests.as_user(alice);
  org := public.create_organization('Reminder Board');
  perform tests.as_super();
  update public.organizations set time_zone = 'UTC' where id = org;
  insert into board.terms (org_id, person_name, user_id, start_date) values
    (org, 'Alice', alice, current_date - 30),
    (org, 'Bob', bob, current_date - 30);
  -- Carol's term ended: no meeting reminders.
  insert into board.terms (org_id, person_name, user_id, start_date, end_date) values
    (org, 'Carol', carol, current_date - 400, current_date - 10);
  insert into board.meetings (org_id, title, meeting_date, start_time, status)
    values (org, 'Tomorrow', current_date + 1, '6:30 PM', 'scheduled') returning id into soon;
  insert into board.meetings (org_id, title, meeting_date, status)
    values (org, 'Next week', current_date + 6, 'scheduled') returning id into next_week;
  insert into board.meetings (org_id, title, meeting_date, status)
    values (org, 'Far', current_date + 30, 'scheduled') returning id into far;
  insert into board.meetings (org_id, title, meeting_date) values (org, 'Draft', current_date + 2);
  insert into board.action_items (org_id, title, assignee_id, due_date) values
    (org, 'Due soon', carol, current_date + 2),
    (org, 'Overdue', bob, current_date - 3),
    (org, 'Long overdue', bob, current_date - 30),
    (org, 'Unassigned', null, current_date + 1);
  insert into board.action_items (org_id, title, assignee_id, due_date, status)
    values (org, 'Done', bob, current_date + 1, 'done');

  perform tests.ok(exists (select 1 from public.email_jobs where name = 'board.reminders'), 'the job is registered');
  perform tests.as_user(alice);
  perform tests.throws('select board.queue_email_reminders()', 'only the sender runs the job', 'permission denied');

  perform tests.as_service();
  n := board.queue_email_reminders();
  -- 2 meetings x 2 current members, plus 2 action items.
  perform tests.ok(n = 6, format('six reminders queued (got %s)', n));
  perform tests.ok(board.queue_email_reminders() = 0, 'running again queues nothing new');

  perform tests.as_super();
  perform tests.ok((select count(*) from public.email_outbox where data->>'title' = 'Tomorrow' and template = 'board.meeting_reminder') = 2, 'both members get the meeting reminder');
  perform tests.ok(not exists (select 1 from public.email_outbox where to_user_id = carol and template = 'board.meeting_reminder'), 'a past member gets no meeting reminders');
  perform tests.ok((select (data->>'days')::int from public.email_outbox where data->>'title' = 'Tomorrow' limit 1) = 1, 'days until the meeting');
  perform tests.ok((select dedupe_key like '%:1d:%' from public.email_outbox where data->>'title' = 'Tomorrow' limit 1), 'tomorrow is the 1-day reminder');
  perform tests.ok((select dedupe_key like '%:7d:%' from public.email_outbox where data->>'title' = 'Next week' limit 1), 'next week is the 7-day reminder');
  perform tests.ok((select (data->>'overdue')::boolean from public.email_outbox where data->>'title' = 'Overdue'), 'overdue item flagged');
  perform tests.ok(not exists (select 1 from public.email_outbox where data->>'title' in ('Far', 'Draft', 'Long overdue', 'Unassigned', 'Done')), 'nothing else is queued');
  perform tests.ok((select bool_and(category = 'reminders' and app = 'board' and org_id = org) from public.email_outbox), 'reminders category, board app');

  -- Moving the meeting makes a new reminder.
  update board.meetings set meeting_date = current_date + 5 where id = soon;
  perform tests.as_service();
  perform tests.ok(board.queue_email_reminders() = 2, 'a moved meeting is reminded again');
end
$$;
rollback;
