-- S-25 part 2: OpenBoardApp's triggers for organizations' workflows (0010, core 0009).
begin;
do $$
declare
  owner uuid := tests.create_user('owner@wf.org', '{"full_name":"Olive Owner"}');
  sam uuid := tests.create_user('sam@wf.org', '{"full_name":"Sam Secretary"}');
  org uuid; other uuid; soon uuid; n int; r record;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Workflow Board');
  other := public.create_organization('Other Board');
  perform tests.add_member(org, sam, 'member');
  perform tests.as_super();
  update public.organizations set time_zone = 'UTC' where id in (org, other);
  insert into board.officers (org_id, user_id, office) values (org, sam, 'secretary');

  perform tests.ok((select count(*) from public.automation_trigger_types where app = 'board') = 3, 'Board offers three triggers');

  -- "A board meeting is less than 5 days away": email the secretary.
  perform tests.as_user(owner);
  perform public.save_workflow(org, null, 'Prep the packet', '', true,
    '{"trigger": {"type": "board.meeting_upcoming", "params": {"days_before": 5}},
      "always": [{"type": "task", "to": {"type": "board.office", "office": "secretary"},
                  "title": "Prepare the packet for {{meeting.title}} on {{meeting.date}}", "due_in_days": 1}]}');
  perform public.save_workflow(org, null, 'Chase overdue items', '', true,
    '{"trigger": {"type": "board.action_item_overdue", "params": {"days_overdue": 2}},
      "always": [{"type": "email", "to": {"type": "subject"}, "subject": "Still open: {{item.title}}", "message": "Due {{item.due_date}}."}]}');
  perform public.save_workflow(org, null, 'Welcome a new meeting', '', true,
    '{"trigger": {"type": "board.meeting_scheduled"},
      "always": [{"type": "task", "to": {"type": "role", "roles": ["owner"]}, "title": "Book a room for {{meeting.title}}"}]}');
  perform tests.as_super();
  insert into board.meetings (org_id, title, meeting_date, status) values
    (org, 'Soon', current_date + 3, 'scheduled'), (org, 'Far', current_date + 20, 'scheduled'),
    (org, 'Draft', current_date + 2, 'draft'), (other, 'Other soon', current_date + 1, 'scheduled');
  select id into soon from board.meetings where title = 'Soon';
  insert into board.action_items (org_id, title, assignee_id, due_date) values
    (org, 'Late report', sam, current_date - 3), (org, 'Not late yet', sam, current_date - 1);

  perform tests.as_service();
  n := public.run_workflows();
  perform tests.as_super();
  perform tests.ok(exists (select 1 from public.automation_tasks where assignee_id = sam
                     and title = 'Prepare the packet for Soon on ' || (current_date + 3)::text), 'meeting within 5 days: the secretary gets a task');
  perform tests.ok(not exists (select 1 from public.automation_tasks where title like 'Prepare the packet for %' and (title like '%Far%' or title like '%Draft%' or title like '%Other soon%')),
    'not for later, draft or other organizations'' meetings');
  perform tests.ok((select count(*) from public.automation_tasks where title like 'Book a room for %') = 2,
    'scheduling a meeting is an event (two scheduled here; the draft and the other organization''s don''t count)');
  perform tests.ok(exists (select 1 from public.email_outbox where template = 'automation.message' and to_user_id = sam
                     and data->>'subject' = 'Still open: Late report'), 'two days overdue: the assignee is emailed');
  perform tests.ok(not exists (select 1 from public.email_outbox where data->>'subject' = 'Still open: Not late yet'), 'not before');
  perform tests.ok((select ctx #>> '{meeting,id}' from public.automation_runs where ctx #>> '{meeting,title}' = 'Soon' and trigger_type = 'board.meeting_upcoming') = soon::text,
    'the run knows its meeting (for actions that add documents)');

  -- Nothing twice; a moved meeting runs again.
  perform tests.as_service();
  perform tests.ok(public.run_workflows() = 0, 'nothing runs twice');
  perform tests.as_super();
  update board.meetings set meeting_date = current_date + 4 where id = soon;
  perform tests.as_service();
  perform tests.ok(public.run_workflows() = 1, 'a meeting moved to a new date runs again');
end
$$;
rollback;
