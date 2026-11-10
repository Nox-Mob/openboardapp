-- Ownership transfer: the owner hands the organization to another active member.
--
-- Until now the account that created an organization stayed its owner forever:
-- memberships policies block any change to or from 'owner', and invitations can't
-- grant it. These functions are the only way ownership moves, and every rule is
-- enforced here, not in the UI:
--   * only the current owner may list candidates or transfer;
--   * the new owner must be another current member with an active account
--     (email confirmed, not banned, not deleted, not anonymous);
--   * the caller must type the new owner's name (their profile name, or their email
--     if they have none), checked case-insensitively, so a transfer can't be one
--     accidental click;
--   * the old owner becomes an administrator and the new member the owner in one
--     transaction, with the org's membership rows locked against a parallel transfer.
-- The existing audit_row trigger on memberships records both role changes with the
-- caller as actor.

-- At most one owner per organization, whatever path a write takes.
create unique index memberships_one_owner on public.memberships (organization_id) where role = 'owner';

create or replace function public.ownership_transfer_candidates(_org uuid)
returns table (user_id uuid, full_name text, email text, role public.org_role, confirm_text text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not public.has_org_role(_org, array['owner']::public.org_role[]) then
    raise exception 'Only the owner can transfer ownership';
  end if;
  return query
    select m.user_id,
           nullif(trim(p.full_name), ''),
           u.email::text,
           m.role,
           coalesce(nullif(trim(p.full_name), ''), u.email::text)
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.organization_id = _org
      and m.user_id <> auth.uid()
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until < now())
      and not coalesce(u.is_anonymous, false)
    order by lower(coalesce(nullif(trim(p.full_name), ''), u.email::text));
end $$;

create or replace function public.transfer_ownership(_org uuid, _new_owner uuid, _confirmation text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _me uuid := auth.uid();
  _expected text;
  _active boolean;
begin
  if _me is null then raise exception 'Not signed in'; end if;

  -- Serialize transfers for this organization.
  perform 1 from public.memberships where organization_id = _org for update;

  if not exists (
    select 1 from public.memberships where organization_id = _org and user_id = _me and role = 'owner'
  ) then
    raise exception 'Only the owner can transfer ownership';
  end if;
  if _new_owner is null or _new_owner = _me then
    raise exception 'Choose another member to become the owner';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), u.email::text),
         u.email_confirmed_at is not null and u.deleted_at is null
           and (u.banned_until is null or u.banned_until < now())
           and not coalesce(u.is_anonymous, false)
    into _expected, _active
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = _org and m.user_id = _new_owner;

  if not found then
    raise exception 'That person is not a member of this organization';
  end if;
  if not _active then
    raise exception 'That account is not active, so it cannot become the owner';
  end if;
  if lower(trim(coalesce(_confirmation, ''))) <> lower(trim(_expected)) then
    raise exception 'The confirmation does not match. Type the new owner''s name exactly as shown.';
  end if;

  update public.memberships set role = 'admin' where organization_id = _org and user_id = _me;
  update public.memberships set role = 'owner' where organization_id = _org and user_id = _new_owner;
end $$;

revoke all on function public.ownership_transfer_candidates(uuid) from public, anon;
revoke all on function public.transfer_ownership(uuid, uuid, text) from public, anon;
grant execute on function public.ownership_transfer_candidates(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid, text) to authenticated;
