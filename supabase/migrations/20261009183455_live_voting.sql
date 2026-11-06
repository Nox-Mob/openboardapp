ALTER TABLE public.organizations
  ADD COLUMN vote_close_modes text[] NOT NULL DEFAULT '{chair}',
  ADD COLUMN vote_timer_minutes integer,
  ADD COLUMN vote_closer_roles public.org_role[] NOT NULL DEFAULT '{owner,admin,chair,secretary}',
  ADD COLUMN seconder_required boolean NOT NULL DEFAULT true,
  ADD COLUMN decision_rule text NOT NULL DEFAULT 'majority_cast';
ALTER TABLE public.organizations
  ADD CONSTRAINT org_vote_close_modes_chk CHECK (cardinality(vote_close_modes) >= 1 AND vote_close_modes <@ ARRAY['chair','auto','timer']::text[]),
  ADD CONSTRAINT org_vote_timer_chk CHECK (vote_timer_minutes IS NULL OR vote_timer_minutes BETWEEN 1 AND 240),
  ADD CONSTRAINT org_decision_rule_chk CHECK (decision_rule IN ('majority_cast','majority_present','two_thirds_cast','chair'));

ALTER TABLE public.agenda_items ADD COLUMN proposed_motion text;

ALTER TABLE public.motions
  ADD COLUMN voting_status text NOT NULL DEFAULT 'manual',
  ADD COLUMN opened_at timestamptz, ADD COLUMN opened_by uuid,
  ADD COLUMN closes_at timestamptz,
  ADD COLUMN closed_at timestamptz, ADD COLUMN closed_by uuid,
  ADD COLUMN vote_record jsonb,
  ADD COLUMN disposition_source text,
  ADD COLUMN disposition_note text,
  ADD COLUMN disposition_by uuid,
  ADD COLUMN disposition_at timestamptz;
ALTER TABLE public.motions
  ADD CONSTRAINT motions_voting_status_chk CHECK (voting_status IN ('manual','open','closed')),
  ADD CONSTRAINT motions_disposition_source_chk CHECK (disposition_source IS NULL OR disposition_source IN ('calculated','recorded'));
CREATE UNIQUE INDEX motions_one_open_vote ON public.motions (meeting_id) WHERE voting_status = 'open';

CREATE TABLE public.vote_electorate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  motion_id uuid NOT NULL REFERENCES public.motions(id) ON DELETE RESTRICT,
  attendance_id uuid,
  user_id uuid NOT NULL,
  person_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (motion_id, user_id)
);
GRANT SELECT ON public.vote_electorate TO authenticated;
GRANT ALL ON public.vote_electorate TO service_role;
ALTER TABLE public.vote_electorate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read the electorate" ON public.vote_electorate FOR SELECT TO authenticated USING (public.is_org_member(organization_id));

CREATE TABLE public.member_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  motion_id uuid NOT NULL REFERENCES public.motions(id) ON DELETE RESTRICT,
  attendance_id uuid,
  user_id uuid NOT NULL,
  person_name text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('yes','no','abstain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (motion_id, user_id)
);
GRANT SELECT ON public.member_votes TO authenticated;
GRANT ALL ON public.member_votes TO service_role;
ALTER TABLE public.member_votes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.vote_is_closed(_motion uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.motions where id = _motion and voting_status = 'closed')
$$;
CREATE POLICY "Own vote, or all votes once closed" ON public.member_votes FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) AND (user_id = auth.uid() OR public.vote_is_closed(motion_id)));

CREATE OR REPLACE FUNCTION public.reject_vote_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  raise exception 'Recorded votes are part of the official record and can never be changed or deleted';
end $$;
CREATE TRIGGER t_immutable BEFORE UPDATE OR DELETE ON public.member_votes FOR EACH ROW EXECUTE FUNCTION public.reject_vote_change();
CREATE TRIGGER t_immutable BEFORE UPDATE OR DELETE ON public.vote_electorate FOR EACH ROW EXECUTE FUNCTION public.reject_vote_change();
CREATE TRIGGER t_audit AFTER INSERT ON public.member_votes FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER t_audit AFTER INSERT ON public.vote_electorate FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- Live-voted motions change only through the voting functions below.
CREATE OR REPLACE FUNCTION public.protect_live_motion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if current_setting('app.vote_rpc', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.voting_status <> 'manual' or new.vote_record is not null then raise exception 'Live votes can only be opened through the voting process'; end if;
    return new;
  end if;
  if old.voting_status <> 'manual' then
    raise exception 'Live votes are part of the official record and can only change through the voting process';
  end if;
  if tg_op = 'UPDATE' and (new.voting_status <> 'manual' or new.vote_record is not null) then
    raise exception 'Live votes can only be opened through the voting process';
  end if;
  return coalesce(new, old);
end $$;
CREATE TRIGGER t_live_motion BEFORE INSERT OR UPDATE OR DELETE ON public.motions FOR EACH ROW EXECUTE FUNCTION public.protect_live_motion();

CREATE OR REPLACE FUNCTION public.start_vote(_meeting uuid, _agenda_item uuid, _text text, _moved_by text, _seconded_by text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _m public.meetings; _o public.organizations; _id uuid; _present int; _n int; _unlinked jsonb;
begin
  select * into _m from public.meetings where id = _meeting for update;
  if _m.id is null then raise exception 'Meeting not found'; end if;
  if not public.can_edit_records(_m.organization_id) then raise exception 'Not allowed'; end if;
  if _m.status <> 'in_progress' then raise exception 'Votes can only be opened while the meeting is in progress'; end if;
  if exists (select 1 from public.motions where meeting_id = _meeting and voting_status = 'open') then raise exception 'Another vote is already open — close it first'; end if;
  if coalesce(trim(_text), '') = '' then raise exception 'Motion text is required'; end if;
  select * into _o from public.organizations where id = _m.organization_id;
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
    jsonb_build_object('decision_rule', _o.decision_rule, 'quorum_required', _o.quorum_count, 'present_voting', _present,
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

-- Internal: tallies a locked open vote and writes the official record. Not callable by users.
CREATE OR REPLACE FUNCTION public.finish_vote(_motion uuid, _how text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _mo public.motions; _y int; _no int; _a int; _size int; _rule text; _qm boolean; _out public.motion_outcome;
begin
  select * into _mo from public.motions where id = _motion;
  select count(*) filter (where vote = 'yes'), count(*) filter (where vote = 'no'), count(*) filter (where vote = 'abstain')
    into _y, _no, _a from public.member_votes where motion_id = _motion;
  select count(*) into _size from public.vote_electorate where motion_id = _motion;
  _rule := _mo.vote_record->>'decision_rule';
  _qm := coalesce((_mo.vote_record->>'quorum_met')::boolean, false);
  _out := null;
  if _qm then
    if _rule = 'majority_cast' and _y + _no > 0 then _out := case when _y > _no then 'carried' else 'failed' end;
    elsif _rule = 'majority_present' and _size > 0 then _out := case when _y * 2 > _size then 'carried' else 'failed' end;
    elsif _rule = 'two_thirds_cast' and _y + _no > 0 then _out := case when _y * 3 >= (_y + _no) * 2 then 'carried' else 'failed' end;
    end if;
  end if;
  perform set_config('app.vote_rpc', 'on', true);
  update public.motions set
    voting_status = 'closed', closed_at = now(), closed_by = auth.uid(),
    votes_yes = _y, votes_no = _no, votes_abstain = _a,
    roll_call = (select coalesce(jsonb_agg(jsonb_build_object('attendance_id', attendance_id, 'person_name', person_name, 'vote', vote) order by person_name), '[]') from public.member_votes where motion_id = _motion),
    outcome = coalesce(_out, 'pending'),
    disposition_source = case when _out is null then null else 'calculated' end,
    disposition_at = case when _out is null then null else now() end,
    vote_record = vote_record || jsonb_build_object(
      'votes_yes', _y, 'votes_no', _no, 'votes_abstain', _a, 'electorate_size', _size,
      'not_voting', (select coalesce(jsonb_agg(e.person_name order by e.person_name), '[]') from public.vote_electorate e
                     where e.motion_id = _motion and not exists (select 1 from public.member_votes v where v.motion_id = _motion and v.user_id = e.user_id)),
      'closed_how', _how, 'calculated', _out is not null,
      'needs_disposition_reason', case when _out is not null then null when not _qm then 'Quorum was not met when the vote opened'
        when _rule = 'chair' then 'Your decision rule leaves the result to the chair' else 'No votes were cast for or against' end)
  where id = _motion;
  perform set_config('app.vote_rpc', 'off', true);
end $$;
REVOKE ALL ON FUNCTION public.finish_vote(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cast_vote(_motion uuid, _vote text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _mo public.motions; _status public.meeting_status; _e public.vote_electorate; _modes text[]; _n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _vote not in ('yes','no','abstain') then raise exception 'Invalid vote'; end if;
  select * into _mo from public.motions where id = _motion for update;
  if _mo.id is null or not public.is_org_member(_mo.organization_id) then raise exception 'Vote not found'; end if;
  if _mo.voting_status <> 'open' then raise exception 'This vote is closed'; end if;
  select status into _status from public.meetings where id = _mo.meeting_id;
  if _status <> 'in_progress' then raise exception 'Votes are only accepted while the meeting is in progress'; end if;
  if _mo.closes_at is not null and now() >= _mo.closes_at then
    perform public.finish_vote(_motion, 'timer');
    return 'expired';
  end if;
  select * into _e from public.vote_electorate where motion_id = _motion and user_id = auth.uid();
  if _e.id is null then raise exception 'You are not on the voter list for this motion (only voting members present when it opened can vote)'; end if;
  insert into public.member_votes (organization_id, motion_id, attendance_id, user_id, person_name, vote)
  values (_mo.organization_id, _motion, _e.attendance_id, auth.uid(), _e.person_name, _vote)
  on conflict (motion_id, user_id) do nothing;
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'You have already voted on this motion'; end if;
  select vote_close_modes into _modes from public.organizations where id = _mo.organization_id;
  if 'auto' = any(_modes) and (select count(*) from public.member_votes where motion_id = _motion) >= (select count(*) from public.vote_electorate where motion_id = _motion) then
    perform public.finish_vote(_motion, 'all_voted');
  end if;
  return 'recorded';
end $$;

CREATE OR REPLACE FUNCTION public.close_vote(_motion uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _mo public.motions; _o public.organizations;
begin
  select * into _mo from public.motions where id = _motion for update;
  if _mo.id is null or not public.is_org_member(_mo.organization_id) then raise exception 'Vote not found'; end if;
  if _mo.voting_status <> 'open' then raise exception 'This vote is already closed'; end if;
  select * into _o from public.organizations where id = _mo.organization_id;
  if _mo.closes_at is not null and now() >= _mo.closes_at then
    perform public.finish_vote(_motion, 'timer'); return;
  end if;
  if not ('chair' = any(_o.vote_close_modes)) then raise exception 'Your organization''s settings don''t allow closing a vote early'; end if;
  if not public.has_org_role(_o.id, _o.vote_closer_roles) then raise exception 'Your role can''t close votes'; end if;
  perform public.finish_vote(_motion, 'chair');
end $$;

CREATE OR REPLACE FUNCTION public.vote_progress(_motion uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare _org uuid;
begin
  select organization_id into _org from public.motions where id = _motion;
  if _org is null or not public.is_org_member(_org) then raise exception 'Vote not found'; end if;
  return jsonb_build_object('cast', (select count(*) from public.member_votes where motion_id = _motion),
                            'electorate', (select count(*) from public.vote_electorate where motion_id = _motion));
end $$;

CREATE OR REPLACE FUNCTION public.record_disposition(_motion uuid, _outcome public.motion_outcome, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _mo public.motions; _o public.organizations;
begin
  select * into _mo from public.motions where id = _motion for update;
  if _mo.id is null or not public.is_org_member(_mo.organization_id) then raise exception 'Vote not found'; end if;
  if _mo.voting_status <> 'closed' then raise exception 'Close the vote before recording its result'; end if;
  select * into _o from public.organizations where id = _mo.organization_id;
  if not public.has_org_role(_o.id, _o.vote_closer_roles) then raise exception 'Your role can''t record vote results'; end if;
  if _outcome = 'pending' then raise exception 'Choose a result'; end if;
  if length(trim(coalesce(_note, ''))) < 3 then raise exception 'An explanation is required'; end if;
  if _mo.disposition_source = 'calculated' and _outcome not in ('tabled','withdrawn') then
    raise exception 'The result was calculated from the decision rule; it can only be changed to tabled or withdrawn';
  end if;
  perform set_config('app.vote_rpc', 'on', true);
  update public.motions set outcome = _outcome, disposition_source = 'recorded', disposition_note = trim(_note),
    disposition_by = auth.uid(), disposition_at = now(),
    vote_record = vote_record || jsonb_build_object('disposition_history', coalesce(vote_record->'disposition_history', '[]') ||
      jsonb_build_array(jsonb_build_object('from', _mo.outcome, 'to', _outcome, 'note', trim(_note), 'by', auth.uid(), 'at', now())))
  where id = _motion;
  perform set_config('app.vote_rpc', 'off', true);
end $$;

REVOKE ALL ON FUNCTION public.start_vote(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cast_vote(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_vote(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vote_progress(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_disposition(uuid, public.motion_outcome, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_vote(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_vote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_disposition(uuid, public.motion_outcome, text) TO authenticated;