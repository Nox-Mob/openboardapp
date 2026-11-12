-- OpenBoardApp's part of the suite demo, second version. STAGING (and local development) only,
-- recorded under "openboardapp:seed" like 0001 (which stays as it was applied).
--
--   * Riverside: 0001's board, meetings and minutes, but in step with the other apps. The
--     directors' terms come from OpenCharterApp (S-14) when it's installed, so 0001's own copies
--     are removed; the treasurer's reports quote what OpenCharterApp collected that month and
--     OpenLedgerApp's checking balance; the demo account has action items due (one overdue).
--   * board.demo_fill_national: Northstar Veterans League's National Executive Committee.
--   * board.demo_fill_post: Post 7 Riverbend's board (its own organization, S-24).
-- The hub's reset fills Charter, then Ledger, then Board, so Board can read both.

do $guard$
begin
  if to_regclass('hub.instance') is not null then
    if coalesce((select environment from hub.instance where id), '') <> 'staging' then
      raise exception 'Refusing to seed: this database is not marked staging.';
    end if;
  elsif exists (select 1 from public.organizations where id <> 'de000000-0000-4000-8000-0000000000a1') then
    raise exception 'Refusing to seed: this database has real organizations.';
  end if;
end
$guard$;

do $rename$
begin
  if to_regprocedure('board.demo_fill_v1(uuid,uuid)') is null then
    alter function board.demo_fill(uuid, uuid) rename to demo_fill_v1;
  end if;
end
$rename$;

-- What OpenCharterApp collected for a unit in a month, in cents (0 without Charter).
create or replace function board._demo_dues(p_unit uuid, p_month date) returns bigint
language plpgsql stable set search_path = '' as $$
declare v bigint := 0;
begin
  if to_regclass('charter.payments') is not null then
    execute $q$select coalesce(sum(amount_minor - refunded_amount_minor), 0) from charter.payments
      where unit_id = $1 and status in ('paid', 'refunded')
        and received_on >= date_trunc('month', $2) and received_on < date_trunc('month', $2) + interval '1 month'$q$
      into v using p_unit, p_month;
  end if;
  return v;
end $$;

-- OpenLedgerApp's Checking balance on a date, in cents (null without Ledger).
create or replace function board._demo_balance(p_org uuid, p_on date) returns bigint
language plpgsql stable set search_path = '' as $$
declare v bigint;
begin
  if to_regclass('ledger.entries') is not null then
    execute $q$select sum(e.amount_cents) from ledger.entries e
      join ledger.transactions t on t.id = e.transaction_id
      join ledger.accounts a on a.id = e.account_id
      where a.org_id = $1 and a.name = 'Checking' and t.transaction_date <= $2$q$
      into v using p_org, p_on;
  end if;
  return v;
end $$;

create or replace function board._demo_money(p_cents bigint) returns text
language sql immutable set search_path = '' as $$
  select '$' || to_char(round(coalesce(p_cents, 0) / 100.0), 'FM999,999,990');
$$;

create or replace function board.demo_fill(p_org uuid, p_owner uuid)
returns void
language plpgsql set search_path = '' as $$
declare
  m record;
  v_dues text; v_balance text;
begin
  perform board.demo_fill_v1(p_org, p_owner);

  -- Charter's officers are already here as synced terms (S-14): drop 0001's own copies.
  if exists (select 1 from board.terms where org_id = p_org and source = 'charter') then
    delete from board.terms t
    where t.org_id = p_org and t.source is null and t.end_date is null
      and exists (select 1 from board.terms c where c.org_id = p_org and c.source = 'charter'
                  and lower(c.person_name) = lower(t.person_name));
  end if;

  -- Treasurer's reports with the real figures (the month before each meeting).
  for m in select id, meeting_date from board.meetings where org_id = p_org and status = 'completed' loop
    v_dues := board._demo_money(board._demo_dues(p_org, (m.meeting_date - interval '1 month')::date));
    v_balance := board._demo_money(board._demo_balance(p_org, m.meeting_date - 1));
    if board._demo_balance(p_org, m.meeting_date - 1) is null then continue; end if;
    update board.agenda_items set notes = format(
        'Operating balance %s. Dues collected last month: %s (from OpenCharterApp). Expenses were in line with the budget.',
        v_balance, v_dues)
      where meeting_id = m.id and title = 'Treasurer''s report';
    -- Approved minutes are locked; this staging seed corrects the figures with triggers paused.
    set local session_replication_role = replica;
    update board.minutes set content = regexp_replace(content,
        'operating balance \$[0-9,]+; dues collected \$[0-9,]+',
        format('operating balance %s; dues collected %s', v_balance, v_dues))
      where meeting_id = m.id;
    set local session_replication_role = origin;
  end loop;

  -- Work for the demo account, due soon.
  insert into board.action_items (org_id, title, details, assignee_id, due_date, status, created_by) values
    (p_org, 'Call the households in their grace period', 'The list is on OpenCharterApp''s Members page (filter: in grace).',
      p_owner, current_date + 3, 'open', p_owner),
    (p_org, 'Confirm the library room for next year''s meetings', null, p_owner, current_date + 9, 'open', p_owner);
end $$;

-- A board's meetings, minutes and tasks, shared by the national and the post below.
create or replace function board._demo_board(p_org uuid, p_owner uuid, p_owner_name text, p_kind text)
returns void
language plpgsql set search_path = '' as $$
declare
  v_national boolean := p_kind = 'national';
  v_title text := case when v_national then 'National Executive Committee' else 'Post Meeting' end;
  v_place text := case when v_national then 'Northstar Veterans League HQ, Saint Paul (and video)' else 'Riverbend Post Home, 22 Depot St' end;
  v_dates date[];
  v_meeting uuid; v_item uuid; v_m int; v_people text[];
begin
  select coalesce(array_agg(person_name order by start_date, person_name), '{}') into v_people
    from board.terms where org_id = p_org and (end_date is null or end_date >= current_date);
  if not (p_owner_name = any (v_people)) then v_people := p_owner_name || v_people; end if;

  v_dates := case when v_national
    then array[current_date - 120, current_date - 30, current_date + 60]
    else array[current_date - 56, current_date - 28, current_date + 6] end;

  insert into board.org_settings (org_id, timezone, quorum_count, vote_recording, decision_rule)
  values (p_org, 'America/Chicago', greatest(2, (array_length(v_people, 1) / 2) + 1), 'totals', 'majority_cast')
  on conflict (org_id) do nothing;
  insert into board.officers (org_id, user_id, office) values (p_org, p_owner, 'chair') on conflict do nothing;

  for v_m in 1..2 loop
    insert into board.meetings (org_id, title, meeting_date, start_time, location, status, created_by)
    values (p_org, v_title, v_dates[v_m], case when v_national then '10:00' else '19:00' end, v_place, 'completed', p_owner)
    returning id into v_meeting;
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes) values
      (p_org, v_meeting, 0, 'Call to order and Pledge of Allegiance', p_owner_name, 5, 'Called to order; a quorum was present.'),
      (p_org, v_meeting, 1, case when v_national then 'Finance Officer''s report' else 'Finance Officer''s report' end,
        coalesce(v_people[4], p_owner_name), 10,
        case when v_national then format('Dues collected last month: %s (from OpenCharterApp). Balance in checking: %s.',
          board._demo_money(board._demo_dues(p_org, (v_dates[v_m] - interval '1 month')::date)),
          board._demo_money(board._demo_balance(p_org, v_dates[v_m] - 1)))
        -- A post's members pay the national; the post keeps its own small fund.
        else (array['Post fund $3,240; canteen sales $410 last month.', 'Post fund $3,515; canteen sales $385 last month.'])[v_m] end);
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
    values (p_org, v_meeting, 2,
      case when v_national then (array['Convention site', 'Relief grants for the posts'])[v_m]
           else (array['Veterans Day ceremony', 'Hall roof repair'])[v_m] end,
      p_owner_name, 20,
      case when v_national then (array['Three bids reviewed; Lakeshore Conference Center offered the best rate.', 'Four posts applied for relief grants for members in hardship.'])[v_m]
           else (array['Color guard, speaker and lunch for the community at the post home.', 'Two quotes for the leaking roof over the hall.'])[v_m] end,
      true,
      case when v_national then (array['Book Lakeshore Conference Center for next year''s convention.', 'Approve $1,500 relief grants to each of the four posts.'])[v_m]
           else (array['Approve up to $600 for the Veterans Day ceremony.', 'Accept the Hanson Roofing quote of $4,800.'])[v_m] end)
    returning id into v_item;
    insert into board.motions (org_id, meeting_id, agenda_item_id, motion_text, moved_by, seconded_by, votes_yes, votes_no, votes_abstain, outcome)
    values (p_org, v_meeting, v_item,
      case when v_national then (array['Book Lakeshore Conference Center for next year''s convention', 'Approve $1,500 relief grants to each of the four posts'])[v_m]
           else (array['Approve up to $600 for the Veterans Day ceremony', 'Accept the Hanson Roofing quote of $4,800'])[v_m] end,
      coalesce(v_people[2], p_owner_name), coalesce(v_people[3], p_owner_name),
      greatest(array_length(v_people, 1) - 1, 1), case when v_m = 2 then 1 else 0 end, 0, 'carried');
    insert into board.minutes (org_id, meeting_id, version, content, status, created_by, submitted_at, approved_by, approved_at)
    values (p_org, v_meeting, 1,
      concat_ws(E'\n', upper(case when v_national then 'Northstar Veterans League' else 'Northstar Veterans League — Post 7 Riverbend' end),
        'Minutes of the ' || v_title, to_char(v_dates[v_m], 'FMMonth FMDD, YYYY') || ' · ' || v_place, '',
        'Present: ' || array_to_string(v_people, ', '), 'A quorum was present.', '',
        '1. Called to order.', '2. Finance Officer''s report accepted.', '3. Motion carried (see the motions).', '4. Adjourned.'),
      case when v_m = 1 then 'approved'::board.minutes_status else 'submitted'::board.minutes_status end,
      p_owner, v_dates[v_m] + 3, case when v_m = 1 then p_owner end, case when v_m = 1 then v_dates[2] end);
  end loop;

  -- The next meeting, with last meeting's minutes up for approval.
  insert into board.meetings (org_id, title, meeting_date, start_time, location, status, created_by)
  values (p_org, v_title, v_dates[3], case when v_national then '10:00' else '19:00' end, v_place, 'scheduled', p_owner)
  returning id into v_meeting;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, is_vote_item, proposed_motion) values
    (p_org, v_meeting, 0, 'Call to order and Pledge of Allegiance', p_owner_name, 5, false, null),
    (p_org, v_meeting, 1, 'Approval of the last minutes', coalesce(v_people[3], p_owner_name), 5, true, 'Approve the minutes of the last meeting as submitted.'),
    (p_org, v_meeting, 2, 'Finance Officer''s report', coalesce(v_people[4], p_owner_name), 10, false, null),
    (p_org, v_meeting, 3, case when v_national then 'Post 12''s request to use OpenBoardApp' else 'Membership drive' end, p_owner_name, 15, false, null),
    (p_org, v_meeting, 4, 'Adjournment', p_owner_name, 5, false, null);

  insert into board.action_items (org_id, meeting_id, title, details, assignee_id, due_date, status, created_by) values
    (p_org, null,
      case when v_national then 'Sign the Lakeshore Conference Center contract' else 'Order wreaths for the Veterans Day ceremony' end,
      null, p_owner, current_date - 2, 'open', p_owner),
    (p_org, null,
      case when v_national then 'Send the convention call to all posts' else 'Get a second roof quote' end,
      null, p_owner, current_date + 4, 'open', p_owner),
    (p_org, null,
      case when v_national then 'Review the posts'' annual reports' else 'Update the post''s contact list' end,
      null, p_owner, v_dates[3] - 3, 'open', p_owner);
end $$;

create or replace function board.demo_fill_national(p_org uuid, p_owner uuid) returns void
language sql set search_path = '' as $$
  select board._demo_board(p_org, p_owner, 'Casey Ramirez', 'national');
$$;

create or replace function board.demo_fill_post(p_org uuid, p_owner uuid) returns void
language sql set search_path = '' as $$
  select board._demo_board(p_org, p_owner, 'Casey Ramirez', 'post');
$$;

revoke all on function board._demo_dues(uuid, date), board._demo_balance(uuid, date), board._demo_money(bigint),
  board._demo_board(uuid, uuid, text, text), board.demo_fill(uuid, uuid), board.demo_fill_v1(uuid, uuid),
  board.demo_fill_national(uuid, uuid), board.demo_fill_post(uuid, uuid)
from public, anon, authenticated;

do $fill$
begin
  if to_regprocedure('hub.reset_suite_demo()') is not null then
    perform hub.reset_suite_demo();
  end if;
end
$fill$;
