-- Deleting an organization that uses OpenCharterApp failed: the cascade reached its mirrored
-- terms (S-14), which refuse to be deleted on their own. They now go with their organization,
-- like the owner's membership does in the core (_guard_owner_changes). Only the DELETE branch
-- changes; everything else is 0005's function as it was.

create or replace function board.terms_charter_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_appointment uuid;
begin
  if coalesce(current_setting('oah.syncing', true), '') = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    -- Deleting the whole organization removes its terms too, mirrored or not.
    if old.source = 'charter' and exists (select 1 from public.organizations o where o.id = old.org_id) then
      raise exception 'This term comes from OpenCharterApp. End the appointment there, or set its end date here.'
        using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.source = 'charter' then
      if new.person_name is distinct from old.person_name or new.user_id is distinct from old.user_id
         or new.person_id is distinct from old.person_id or new.position is distinct from old.position
         or new.start_date is distinct from old.start_date or new.source is distinct from old.source
         or new.source_id is distinct from old.source_id then
        raise exception 'This term comes from OpenCharterApp: change it there (only its end date can be set here).'
          using errcode = '42501';
      end if;
      if new.end_date is distinct from old.end_date then
        if new.end_date is null or new.end_date > current_date then
          raise exception 'This term comes from OpenCharterApp: set its planned end there. Here you can end it today or earlier.'
            using errcode = '42501';
        end if;
        if to_regprocedure('charter.end_appointment_from_board(uuid,date)') is not null then
          execute 'select charter.end_appointment_from_board($1, $2)' using old.source_id, new.end_date;
        end if;
      end if;
    end if;
    return new;
  end if;
  -- INSERT: a term made here; mirror it in OpenCharterApp when the seat and person match there.
  if new.source is null
     and to_regprocedure('charter.appointment_from_board(uuid,text,uuid,text,date)') is not null then
    execute 'select charter.appointment_from_board($1, $2, $3, $4, $5)'
      into v_appointment using new.org_id, new.person_name, new.user_id, new.position, new.start_date;
    if v_appointment is not null then
      new.source := 'charter';
      new.source_id := v_appointment;
      new.notes := coalesce(nullif(new.notes, ''), 'Also in OpenCharterApp');
    end if;
  end if;
  return new;
end $$;
