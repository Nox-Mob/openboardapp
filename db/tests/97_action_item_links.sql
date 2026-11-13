-- C-08: an action item's reminder has "Mark it done" only when the organization allows it
-- (0016, core 0014), and the link marks it done through board.complete_action_item.
begin;
do $$
declare
  alice uuid := tests.create_user('alice@links.org', '{"full_name":"Alice"}');
  bob uuid := tests.create_user('bob@links.org', '{"full_name":"Bob"}');
  org uuid; item uuid; tok text; v jsonb;
begin
  perform tests.as_user(alice);
  org := public.create_organization('Links Board');
  perform tests.as_super();
  update public.organizations set time_zone = 'UTC' where id = org;
  insert into board.action_items (org_id, title, assignee_id, due_date) values (org, 'Send the minutes', alice, current_date + 1);
  perform tests.as_service();
  perform board.queue_email_reminders();
  perform tests.as_super();
  perform tests.ok((select data -> 'actions' from public.email_outbox where data ->> 'title' = 'Send the minutes') = '[]'::jsonb,
    'no button until the organization allows it');
  perform tests.ok(not exists (select 1 from public.action_links), 'and no links made');

  perform tests.as_user(alice);
  perform public.set_email_action_allowed(org, 'board_action_items', true);
  perform tests.as_super();
  insert into board.action_items (org_id, title, assignee_id, due_date) values (org, 'Book the room', alice, current_date + 1) returning id into item;
  perform tests.as_service();
  perform board.queue_email_reminders();
  perform board.queue_email_reminders();
  perform tests.as_super();
  select data #>> '{actions,0,token}' into tok from public.email_outbox where data ->> 'title' = 'Book the room';
  perform tests.ok(tok is not null, 'Mark it done in the reminder');
  perform tests.ok((select count(*) from public.action_links where user_id = alice) = 1, 'one link, though the job ran twice');

  perform tests.as_user(bob);
  perform tests.ok((public.action_link(tok)) ->> 'state' = 'other_person', 'not for anyone else');
  perform tests.as_user(alice);
  v := public.action_link(tok);
  perform tests.ok(v ->> 'state' = 'ready' and v #>> '{rpc,schema}' = 'board' and v #>> '{rpc,fn}' = 'complete_action_item', 'Board''s own function');
  perform board.complete_action_item((v #>> '{rpc,args,p_id}')::uuid);
  perform public.consume_action_link(tok);
  perform tests.as_super();
  perform tests.ok((select status::text from board.action_items where id = item) = 'done', 'marked done');
end $$;
rollback;
