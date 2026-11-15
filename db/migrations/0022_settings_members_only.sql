-- Security review round 7: board.settings(org) returned any organization's Board settings (time
-- zone, quorum, voting rules, who may edit) to any signed-in person who knew the organization's
-- id. It now returns the real settings only to people who can open OpenBoardApp in that
-- organization, and to server tasks (no signed-in person). Everyone else gets the defaults, as
-- if the organization had never saved any. The Board functions that call it are already limited
-- to members, so they keep seeing the real settings.

create or replace function board.settings(p_org uuid)
returns board.org_settings
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s from board.org_settings s
     where s.org_id = p_org
       and (auth.uid() is null or p_org in (select board.readable_org_ids()))),
    row(p_org, 'America/Chicago', 1, 'totals', '{chair}'::text[], null::int,
        '{owner,admin,chair,secretary}'::text[], true, 'majority_cast', now())::board.org_settings
  );
$$;

revoke all on function board.settings(uuid) from public, anon;
grant execute on function board.settings(uuid) to authenticated;
