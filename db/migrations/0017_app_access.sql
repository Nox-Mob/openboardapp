-- No access in OpenBoardApp (core 0015, owner decision 2026-11-13). Someone with No access here
-- (set for them, or "none" in their named role) can't read any of the organization's board
-- records or files; they stay in the organization and keep their roles in the other apps. The
-- owner always has access. Every read rule goes through board.readable_org_ids, and the files'
-- read rule checks the same; editing already needed a Board role.

create or replace function board.readable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid()
    and (to_regprocedure('public.can_open_app(uuid,text,uuid)') is null or public.can_open_app(m.org_id, 'board', m.user_id));
$$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  drop policy if exists "board members read files" on storage.objects;
  create policy "board members read files" on storage.objects for select to authenticated
    using (bucket_id = 'board-files' and ((storage.foldername(name))[1])::uuid in (select board.readable_org_ids()));
end $$;
