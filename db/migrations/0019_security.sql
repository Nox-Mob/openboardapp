-- Security review (2026-11-14).

-- One update policy for action items instead of two (advisor multiple_permissive_policies), same
-- rule: editors update any item in their organizations; the person it's assigned to updates
-- their own (marking it done), while the organization can still be changed.
drop policy if exists "assignee updates own task" on board.action_items;
drop policy if exists "editors update" on board.action_items;
drop policy if exists "editors or the assignee update" on board.action_items;
create policy "editors or the assignee update" on board.action_items for update to authenticated
  using (org_id in (select board.editable_org_ids())
         or (assignee_id = (select auth.uid()) and public.can_write(org_id, 'board')))
  with check (org_id in (select board.editable_org_ids())
              or (assignee_id = (select auth.uid()) and public.can_write(org_id, 'board')));

-- Documents and packets: at most 25 MB a file (owner decision; a packet PDF larger than that is
-- unusual and slow to open on a phone).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets set file_size_limit = 26214400 where id = 'board-files'$q$;
  end if;
end $$;

select public._tune_schema('board');
