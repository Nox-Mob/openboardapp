-- S-28 (0015, core 0012): OpenBoardApp's steps for the workflow designer.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@dzb.org', '{"full_name":"Olive Owner"}');
  sam uuid := tests.create_user('sam@dzb.org', '{"full_name":"Sam Secretary"}');
  org uuid; other uuid; m1 uuid; v jsonb;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Designer Board');
  other := public.create_organization('Other Board');
  perform tests.add_member(org, sam, 'member');
  perform tests.as_super();
  insert into board.meetings (org_id, title, meeting_date, status) values
    (org, 'Soon', current_date + 3, 'scheduled'), (org, 'Later', current_date + 60, 'scheduled'),
    (org, 'Draft', current_date + 5, 'draft'), (other, 'Elsewhere', current_date + 3, 'scheduled');
  select id into m1 from board.meetings where title = 'Soon';
  insert into board.action_items (org_id, title, assignee_id, due_date, status) values
    (org, 'Late thing', sam, current_date - 4, 'open'), (org, 'Fine thing', sam, current_date + 4, 'open'),
    (org, 'Done thing', sam, current_date - 9, 'done');

  perform tests.ok((select count(*) from public.automation_action_types where app = 'board' and kind in ('query', 'call')) = 3, 'three designer steps');
  v := board.wf_find_meetings(org, '{"to_days": 30}');
  perform tests.ok((v->>'count')::int = 1 and v #>> '{rows,0,title}' = 'Soon', 'scheduled meetings in the next 30 days, this organization only');
  perform tests.ok((board.wf_find_meetings(org, '{"to_days": 90, "status": "any"}')->>'count')::int = 3, 'any status, further out');
  v := board.wf_find_action_items(org, '{"status": "overdue"}');
  perform tests.ok((v->>'count')::int = 1 and v #>> '{rows,0,email}' = 'sam@dzb.org' and (v #>> '{rows,0,days_overdue}')::int = 4,
    'overdue items, with who they''re assigned to');
  v := board.wf_create_action_item(org, jsonb_build_object('title', 'Follow up', 'assignee_email', 'sam@dzb.org', 'meeting_id', m1));
  perform tests.ok((v->>'assigned')::boolean and exists (select 1 from board.action_items where title = 'Follow up' and assignee_id = sam and meeting_id = m1),
    'creates an action item for someone, by email');
  v := board.wf_create_action_item(org, jsonb_build_object('title', 'For a stranger', 'assignee_email', 'nobody@x.org'));
  perform tests.ok(not (v->>'assigned')::boolean, 'not assigned to someone outside the organization');
  perform tests.throws(format('select board.wf_create_action_item(%L, %L)', org, '{"title": ""}'), 'needs a title', 'needs a title');

  -- A designer workflow: overdue items → an email to each person.
  perform tests.as_user(owner);
  v := public.test_workflow(org, '{"version": 2, "trigger": {"type": "core.schedule", "params": {"frequency": "daily", "hour": 7}},
    "steps": [
      {"id": "late", "type": "board.find_action_items", "params": {"status": "overdue"}},
      {"id": "each", "type": "foreach", "params": {"items": "{{steps.late.rows}}"}, "steps": [
        {"id": "nudge", "type": "email", "params": {"to": {"type": "address", "email": "{{item.email}}"},
          "subject": "{{item.title}} is {{item.days_overdue}} days late", "message": "m"}}]}]}');
  perform tests.ok(v->>'status' = 'succeeded', 'the test run went through the overdue items');
  perform tests.ok(exists (select 1 from jsonb_array_elements(v->'trace') t where t->>'key' = 'nudge[0]' and t->>'detail' = 'Would email 1 person'),
    'one email per item, only described');
end $$;
rollback;
\echo ok
