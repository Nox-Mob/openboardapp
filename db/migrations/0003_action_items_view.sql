-- Tasks for the hub's dashboard (S-15, SHARED-SPEC §3.6): Board's action items, read-only, with the
-- caller's own row security. The hub shows each person the open ones assigned to them.
-- Columns and meanings: docs/INTEGRATION.md. Add columns at the end; never remove or rename one.
create view board.api_action_items with (security_invoker = true) as
select
  a.id,
  a.org_id,
  a.title,
  a.assignee_id,
  a.due_date,
  a.status::text as status,
  a.meeting_id,
  m.title as meeting_title,
  '/board/tasks'::text as link,
  a.created_at
from board.action_items a
left join board.meetings m on m.id = a.meeting_id;

comment on view board.api_action_items is 'Board action items (tasks). docs/INTEGRATION.md';
grant select on board.api_action_items to authenticated;
