ALTER TABLE public.member_votes DROP CONSTRAINT IF EXISTS member_votes_vote_check;
ALTER TABLE public.member_votes ADD CONSTRAINT member_votes_vote_check CHECK (vote IN ('yes','no','abstain','recused'));
ALTER TABLE public.motions ADD COLUMN IF NOT EXISTS votes_recused integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.finish_vote(_motion uuid, _how text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _mo public.motions; _y int; _no int; _a int; _r int; _size int; _rule text; _qm boolean; _out public.motion_outcome;
begin
  select * into _mo from public.motions where id = _motion;
  select count(*) filter (where vote = 'yes'), count(*) filter (where vote = 'no'), count(*) filter (where vote = 'abstain'), count(*) filter (where vote = 'recused')
    into _y, _no, _a, _r from public.member_votes where motion_id = _motion;
  select count(*) into _size from public.vote_electorate where motion_id = _motion;
  _rule := _mo.vote_record->>'decision_rule';
  _qm := coalesce((_mo.vote_record->>'quorum_met')::boolean, false);
  _out := null;
  if _qm then
    if _rule = 'majority_cast' and _y + _no > 0 then _out := case when _y > _no then 'carried' else 'failed' end;
    elsif _rule = 'majority_present' and _size - _r > 0 then _out := case when _y * 2 > _size - _r then 'carried' else 'failed' end;
    elsif _rule = 'two_thirds_cast' and _y + _no > 0 then _out := case when _y * 3 >= (_y + _no) * 2 then 'carried' else 'failed' end;
    end if;
  end if;
  perform set_config('app.vote_rpc', 'on', true);
  update public.motions set
    voting_status = 'closed', closed_at = now(), closed_by = auth.uid(),
    votes_yes = _y, votes_no = _no, votes_abstain = _a, votes_recused = _r,
    roll_call = (select coalesce(jsonb_agg(jsonb_build_object('attendance_id', attendance_id, 'person_name', person_name, 'vote', vote) order by person_name), '[]') from public.member_votes where motion_id = _motion),
    outcome = coalesce(_out, 'pending'),
    disposition_source = case when _out is null then null else 'calculated' end,
    disposition_at = case when _out is null then null else now() end,
    vote_record = vote_record || jsonb_build_object(
      'votes_yes', _y, 'votes_no', _no, 'votes_abstain', _a, 'votes_recused', _r, 'electorate_size', _size,
      'recused', (select coalesce(jsonb_agg(person_name order by person_name), '[]') from public.member_votes where motion_id = _motion and vote = 'recused'),
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
  if _vote not in ('yes','no','abstain','recused') then raise exception 'Invalid vote'; end if;
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
REVOKE ALL ON FUNCTION public.cast_vote(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, text) TO authenticated;