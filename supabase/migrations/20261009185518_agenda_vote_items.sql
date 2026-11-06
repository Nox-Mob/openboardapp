ALTER TABLE public.agenda_items
  ADD COLUMN is_vote_item boolean NOT NULL DEFAULT false,
  ADD COLUMN decision_rule text;
ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_decision_rule_chk CHECK (decision_rule IS NULL OR decision_rule IN ('majority_cast','majority_present','two_thirds_cast','chair'));
UPDATE public.agenda_items SET is_vote_item = true WHERE proposed_motion IS NOT NULL;
CREATE OR REPLACE FUNCTION public.start_vote(_meeting uuid, _agenda_item uuid, _text text, _moved_by text, _seconded_by text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _rule text; _m public.meetings; _o public.organizations; _id uuid; _present int; _n int; _unlinked jsonb;
begin
  select * into _m from public.meetings where id = _meeting for update;
  if _m.id is null then raise exception 'Meeting not found'; end if;
  if not public.can_edit_records(_m.organization_id) then raise exception 'Not allowed'; end if;
  if _m.status <> 'in_progress' then raise exception 'Votes can only be opened while the meeting is in progress'; end if;
  if exists (select 1 from public.motions where meeting_id = _meeting and voting_status = 'open') then raise exception 'Another vote is already open — close it first'; end if;
  if coalesce(trim(_text), '') = '' then raise exception 'Motion text is required'; end if;
  select * into _o from public.organizations where id = _m.organization_id;
  _rule := _o.decision_rule;
  if _agenda_item is not null then
    select coalesce(a.decision_rule, _o.decision_rule) into _rule from public.agenda_items a where a.id = _agenda_item and a.meeting_id = _meeting;
    if _rule is null then raise exception 'Agenda item belongs to another meeting'; end if;
  end if;
  _moved_by := nullif(trim(coalesce(_moved_by, '')), '');
  _seconded_by := nullif(trim(coalesce(_seconded_by, '')), '');
  if _o.seconder_required and _seconded_by is null then raise exception 'Your organization requires a seconder before a vote'; end if;
  if _moved_by is not null and _moved_by = _seconded_by then raise exception 'The same person can''t move and second'; end if;
  select count(*) into _present from public.attendance where meeting_id = _meeting and status in ('present','remote') and is_voting;
  select coalesce(jsonb_agg(person_name order by person_name), '[]') into _unlinked from public.attendance
    where meeting_id = _meeting and status in ('present','remote') and is_voting and user_id is null;

  perform set_config('app.vote_rpc', 'on', true);
  insert into public.motions (organization_id, meeting_id, agenda_item_id, motion_text, moved_by, seconded_by, outcome, voting_status, opened_at, opened_by, closes_at, vote_record)
  values (_m.organization_id, _meeting, _agenda_item, trim(_text), _moved_by, _seconded_by, 'pending', 'open', now(), auth.uid(),
    case when 'timer' = any(_o.vote_close_modes) and _o.vote_timer_minutes is not null then now() + make_interval(mins => _o.vote_timer_minutes) end,
    jsonb_build_object('decision_rule', _rule, 'org_default_rule', _o.decision_rule, 'quorum_required', _o.quorum_count, 'present_voting', _present,
      'quorum_met', _present >= _o.quorum_count, 'seconder_required', _o.seconder_required, 'close_modes', to_jsonb(_o.vote_close_modes),
      'present_not_linked', _unlinked))
  returning id into _id;

  insert into public.vote_electorate (organization_id, motion_id, attendance_id, user_id, person_name)
  select distinct on (a.user_id) _m.organization_id, _id, a.id, a.user_id, a.person_name from public.attendance a
   where a.meeting_id = _meeting and a.status in ('present','remote') and a.is_voting and a.user_id is not null
   order by a.user_id, a.created_at;
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'No eligible voters: mark voting members present and link them to their accounts on the Attendance tab'; end if;
  update public.motions set vote_record = vote_record || jsonb_build_object('electorate',
    (select jsonb_agg(person_name order by person_name) from public.vote_electorate where motion_id = _id)) where id = _id;
  perform set_config('app.vote_rpc', 'off', true);
  return _id;
end $$;