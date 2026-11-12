-- Board members in sync with OpenCharterApp (S-14). For organizations that use both apps,
-- OpenCharterApp's officers at the organization level appear here as terms, and the two stay in
-- step (OpenCharterApp's 0005 has the other half):
--   * board.sync_term_from_charter: Charter appoints, changes or ends an officer, the matching term
--     here follows (source = 'charter', source_id = the appointment).
--   * A mirrored term can't be renamed, moved or deleted here (change it in OpenCharterApp); setting
--     its end date to today or earlier ends the appointment there.
--   * A new term added here becomes a Charter appointment when its position matches a Charter seat
--     and its person matches a Charter member; otherwise it stays Board-only.
-- The transaction setting `oah.syncing` stops the two sides from echoing each other. The sync
-- functions are trigger-only (security definer, not callable by clients); see docs/INTEGRATION.md.

alter table board.terms
  add column source text check (source is null or source = 'charter'),
  add column source_id uuid;
create unique index terms_source_uidx on board.terms (source, source_id) where source is not null;

create function board.sync_term_from_charter(
  p_org uuid, p_appointment uuid, p_person_name text, p_user_id uuid,
  p_position text, p_start date, p_end date, p_removed boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('oah.syncing', 'on', true);
  if p_removed then
    delete from board.terms where source = 'charter' and source_id = p_appointment;
  else
    insert into board.terms (org_id, person_name, user_id, position, start_date, end_date, notes, source, source_id)
    values (p_org, p_person_name, p_user_id, coalesce(nullif(btrim(p_position), ''), 'Officer'), p_start, p_end,
            'From OpenCharterApp', 'charter', p_appointment)
    on conflict (source, source_id) where source is not null do update
      set person_name = excluded.person_name, user_id = excluded.user_id, position = excluded.position,
          start_date = excluded.start_date, end_date = excluded.end_date;
  end if;
  perform set_config('oah.syncing', '', true);
end $$;

create function board.terms_charter_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_appointment uuid;
begin
  if coalesce(current_setting('oah.syncing', true), '') = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.source = 'charter' then
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

create trigger terms_charter_sync before insert or update or delete on board.terms
  for each row execute function board.terms_charter_sync();

revoke all on function board.sync_term_from_charter(uuid, uuid, text, uuid, text, date, date, boolean) from public, anon, authenticated;
revoke all on function board.terms_charter_sync() from public, anon, authenticated;

-- Officers OpenCharterApp already has, once (only on a database with OpenCharterApp).
do $$
begin
  if to_regclass('charter.appointments') is not null then
    perform set_config('oah.syncing', 'on', true);
    insert into board.terms (org_id, person_name, user_id, position, start_date, end_date, notes, source, source_id)
    select a.org_id,
           coalesce(nullif(p.display_name, ''), nullif(p.email, ''), 'Officer'),
           p.user_id,
           coalesce(o.title, t.title),
           a.starts_on,
           coalesce(a.ended_on, a.planned_end),
           'From OpenCharterApp', 'charter', a.id
    from charter.appointments a
    join charter.seat_templates t on t.id = a.template_id
    left join charter.seat_title_overrides o on o.template_id = t.id and o.unit_id = a.unit_id
    left join charter.member_profiles p on p.id = a.profile_id
    where a.unit_id = a.org_id
    on conflict (source, source_id) where source is not null do nothing;
    perform set_config('oah.syncing', '', true);
  end if;
end $$;
