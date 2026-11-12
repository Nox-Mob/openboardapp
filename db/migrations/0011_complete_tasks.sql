-- S-19: finishing a task from the hub's dashboard. An open action item can be marked done with a
-- click by the person it's assigned to, or by someone who edits the board's records.
-- board.complete_action_item runs as the caller (security invoker): the same row security,
-- read-only billing rule and audit trigger as marking it done in OpenBoardApp.
-- board.api_action_items gains `completable` at the end (never remove or rename a column).

create or replace function board.complete_action_item(p_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  update board.action_items set status = 'done' where id = p_id and status in ('open', 'in_progress');
  if not found then
    raise exception 'This action item is already done, or isn''t yours to finish.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function board.complete_action_item(uuid) from public, anon;
grant execute on function board.complete_action_item(uuid) to authenticated;

create or replace view board.api_action_items with (security_invoker = true) as
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
  a.created_at,
  -- S-19: the viewer can mark it done from the hub.
  (a.status in ('open', 'in_progress') and (a.assignee_id = auth.uid() or board.can_edit_records(a.org_id))) as completable
from board.action_items a
left join board.meetings m on m.id = a.meeting_id;
