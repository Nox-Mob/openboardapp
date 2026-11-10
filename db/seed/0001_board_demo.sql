-- OpenBoardApp's part of the suite demo, STAGING (and local development) only. Applied by
-- scripts/migrate.mjs --seed (Migrate → staging), recorded under "openboardapp:seed".
--
-- The suite has one demo organization, "Riverside Community Association", owned by the demo
-- account demo@demo.openapphub.org, and one empty test account test@demo.openapphub.org (both
-- password OpenAppHubDemo2026). OpenAppHub creates them and resets everything every 12 hours
-- (hub.reset_suite_demo, the hub's demo-reset workflow), calling board.demo_fill for Board's
-- records: three months of a neighbourhood association's board, dated from the day it runs.
--
-- Without the hub (a self-hosted development database) this file creates the same two
-- accounts and the organization itself, once.

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

-- Board's records for the demo organization. Run by the hub's reset as the database owner,
-- after the organization (owned by p_owner) was created afresh, so it only inserts.
create or replace function board.demo_fill(p_org uuid, p_owner uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_people text[] := array['Jordan Lee', 'Sam Chen', 'Taylor Brooks', 'Priya Patel', 'Marcus Johnson'];
  v_emails text[] := array['jordan.lee', 'sam.chen', 'taylor.brooks', 'priya.patel', 'marcus.johnson'];
  v_person uuid[] := '{}';
  v_pos uuid[] := '{}';
  v_titles text[] := array['President', 'Vice President', 'Secretary', 'Treasurer', 'Member at Large', 'Member at Large'];
  v_finance uuid; v_events uuid;
  v_meeting uuid; v_item uuid; v_items uuid[];
  v_dates date[];
  v_status board.attendance_status;
  v_i int; v_m int; v_p uuid;
  v_month text;
  v_minutes text;
  v_dues int[] := array[3120, 1985, 2460];
  v_balance int[] := array[18420, 19950, 21310];
begin
  if not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'board.demo_fill: organization % not found', p_org;
  end if;

  -- Monthly meetings: three held (about 11, 7 and 2 weeks ago), the next one in about 2 weeks.
  v_dates := array[
    current_date - 77 + ((4 - extract(dow from current_date - 77)::int + 7) % 7),
    current_date - 49 + ((4 - extract(dow from current_date - 49)::int + 7) % 7),
    current_date - 21 + ((4 - extract(dow from current_date - 21)::int + 7) % 7),
    current_date + 7 + ((4 - extract(dow from current_date + 7)::int + 7) % 7)
  ];

  insert into board.org_settings (org_id, timezone, quorum_count, vote_recording, decision_rule)
  values (p_org, 'America/Chicago', 4, 'totals', 'majority_cast')
  on conflict (org_id) do update set quorum_count = excluded.quorum_count;

  -- The demo account chairs the board; the other five directors have no sign-in.
  insert into board.officers (org_id, user_id, office) values (p_org, p_owner, 'chair')
  on conflict do nothing;
  for v_i in 1..5 loop
    insert into board.people (org_id, full_name, email, notes)
    values (p_org, v_people[v_i], v_emails[v_i] || '@riverside.example.org',
      case v_i when 3 then 'Treasurer since January; CPA by trade.' else null end)
    returning id into v_p;
    v_person := v_person || v_p;
  end loop;

  for v_i in 1..6 loop
    insert into board.positions (org_id, title, term_years, sort_order)
    values (p_org, v_titles[v_i] || case when v_i = 6 then ' (2)' else '' end,
      case when v_i <= 4 then 2 else 1 end, v_i - 1)
    returning id into v_p;
    v_pos := v_pos || v_p;
  end loop;

  -- Terms: the president elected last year, the others at the annual meeting.
  insert into board.terms (org_id, person_name, user_id, position, position_id, start_date, notes)
  values (p_org, 'Alex Morgan', p_owner, 'President', v_pos[1], current_date - 420,
    'Elected at the annual meeting.');
  for v_i in 1..5 loop
    insert into board.terms (org_id, person_name, person_id, position, position_id, start_date, notes)
    values (p_org, v_people[v_i], v_person[v_i], v_titles[v_i + 1], v_pos[v_i + 1],
      current_date - case when v_i in (1, 3) then 420 else 150 end, null);
  end loop;
  -- History: the previous treasurer's term, handed over in the spring.
  insert into board.terms (org_id, person_name, position, position_id, start_date, end_date, notes)
  values (p_org, 'Dana Whitfield', 'Treasurer', v_pos[4], current_date - 790, current_date - 421,
    'Stepped down after two terms.');

  insert into board.committees (org_id, name, description)
  values (p_org, 'Finance Committee', 'Prepares the budget and reviews the monthly statements.')
  returning id into v_finance;
  insert into board.committees (org_id, name, description)
  values (p_org, 'Events Committee', 'Plans the fall festival, clean-ups and the holiday drive.')
  returning id into v_events;
  insert into board.committee_members (org_id, committee_id, person_name, person_id, role) values
    (p_org, v_finance, 'Taylor Brooks', v_person[3], 'Chair'),
    (p_org, v_events, 'Priya Patel', v_person[4], 'Chair'),
    (p_org, v_events, 'Marcus Johnson', v_person[5], 'Member');
  insert into board.committee_members (org_id, committee_id, person_name, user_id, role) values
    (p_org, v_finance, 'Alex Morgan', p_owner, 'Member');

  insert into board.meeting_templates (org_id, name, meeting_title, start_time, location, agenda, created_by)
  values (p_org, 'Monthly board meeting', 'Regular Board Meeting', '18:30',
    'Riverside Library, Community Room',
    '[{"title":"Call to order","duration_minutes":5},
      {"title":"Approval of previous minutes","duration_minutes":5,"is_vote_item":true,"proposed_motion":"Approve the minutes of the previous meeting as submitted."},
      {"title":"Treasurer''s report","duration_minutes":10},
      {"title":"Membership report","duration_minutes":10},
      {"title":"Committee reports","duration_minutes":15},
      {"title":"New business","duration_minutes":20},
      {"title":"Adjournment","duration_minutes":5}]'::jsonb, p_owner);

  -- The three meetings held.
  for v_m in 1..3 loop
    v_month := to_char(v_dates[v_m], 'FMMonth');
    insert into board.meetings (org_id, title, meeting_date, start_time, location, status, created_by)
    values (p_org, 'Regular Board Meeting', v_dates[v_m], '18:30',
      'Riverside Library, Community Room', 'completed', p_owner)
    returning id into v_meeting;

    v_items := '{}';
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
    values (p_org, v_meeting, 0, 'Call to order', 'Alex Morgan', 5,
      'The President called the meeting to order at 6:3' || v_m || ' PM. A quorum was present.')
    returning id into v_item; v_items := v_items || v_item;
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
    values (p_org, v_meeting, 1, 'Approval of previous minutes', 'Sam Chen', 5,
      'The minutes of the previous meeting were reviewed.', true,
      'Approve the minutes of the previous meeting as submitted.')
    returning id into v_item; v_items := v_items || v_item;
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
    values (p_org, v_meeting, 2, 'Treasurer''s report', 'Taylor Brooks', 10,
      format('Operating balance $%s. Dues collected this month: $%s. Expenses were in line with the budget; the insurance renewal is the largest item ahead.',
        to_char(v_balance[v_m], 'FM99,999'), to_char(v_dues[v_m], 'FM9,999')))
    returning id into v_item; v_items := v_items || v_item;
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
    values (p_org, v_meeting, 3, 'Membership report', 'Jordan Lee', 10,
      (array['14 new members joined; renewals are running ahead of last year.',
             '9 new members, 31 renewals. Reminder letters go out to 22 households in grace.',
             '11 new members. Retention since the spring is 91%.'])[v_m])
    returning id into v_item; v_items := v_items || v_item;
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
    values (p_org, v_meeting, 4,
      (array['Fall festival budget', 'Park bench repairs', 'Holiday food drive'])[v_m],
      (array['Priya Patel', 'Marcus Johnson', 'Priya Patel'])[v_m], 15,
      (array['The Events Committee presented a plan for the October festival with 6 vendors and a bounce house.',
             'Three benches on the river trail have broken slats. Two contractor quotes were reviewed.',
             'Partnering with the St. Mark''s pantry for collection boxes at four locations.'])[v_m],
      true,
      (array['Approve up to $2,500 for the fall festival.',
             'Authorize up to $1,200 from reserves to repair three park benches.',
             'Approve $400 for food drive supplies and signage.'])[v_m])
    returning id into v_item; v_items := v_items || v_item;
    insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
    values (p_org, v_meeting, 5, 'Adjournment', 'Alex Morgan', 5,
      'There being no further business, the meeting was adjourned at 7:4' || v_m || ' PM.')
    returning id into v_item; v_items := v_items || v_item;

    insert into board.attendance (org_id, meeting_id, person_name, user_id, status, is_voting)
    values (p_org, v_meeting, 'Alex Morgan', p_owner, 'present', true);
    for v_i in 1..5 loop
      v_status := case
        when v_m = 2 and v_i = 5 then 'excused'::board.attendance_status
        when v_m = 3 and v_i = 4 then 'remote'::board.attendance_status
        else 'present'::board.attendance_status end;
      insert into board.attendance (org_id, meeting_id, person_name, person_id, status, is_voting)
      values (p_org, v_meeting, v_people[v_i], v_person[v_i], v_status, true);
    end loop;

    insert into board.motions (org_id, meeting_id, agenda_item_id, motion_text, moved_by, seconded_by,
        votes_yes, votes_no, votes_abstain, outcome)
    values
      (p_org, v_meeting, v_items[2], 'Approve the minutes of the previous meeting as submitted',
        'Sam Chen', 'Jordan Lee', case when v_m = 2 then 5 else 6 end, 0, 0, 'carried'),
      (p_org, v_meeting, v_items[5],
        (array['Approve up to $2,500 for the fall festival',
               'Authorize up to $1,200 from reserves to repair three park benches',
               'Approve $400 for food drive supplies and signage'])[v_m],
        (array['Priya Patel', 'Taylor Brooks', 'Priya Patel'])[v_m],
        (array['Marcus Johnson', 'Sam Chen', 'Alex Morgan'])[v_m],
        (array[5, 4, 6])[v_m], (array[1, 0, 0])[v_m], (array[0, 1, 0])[v_m], 'carried');

    v_minutes := concat_ws(E'\n',
      'RIVERSIDE COMMUNITY ASSOCIATION',
      'Minutes of the Regular Board Meeting',
      to_char(v_dates[v_m], 'FMMonth FMDD, YYYY') || ' · 6:30 PM · Riverside Library, Community Room',
      '',
      'Present: Alex Morgan, Jordan Lee, Sam Chen, Taylor Brooks' ||
        case when v_m = 3 then ', Marcus Johnson; Priya Patel (remote)' when v_m = 2 then ', Priya Patel; excused: Marcus Johnson' else ', Priya Patel, Marcus Johnson' end,
      'A quorum was present.',
      '',
      '1. Call to order. The President called the meeting to order.',
      '2. Previous minutes approved as submitted.',
      format('3. Treasurer''s report: operating balance $%s; dues collected $%s. Accepted as presented.',
        to_char(v_balance[v_m], 'FM99,999'), to_char(v_dues[v_m], 'FM9,999')),
      '4. Membership report received.',
      '5. ' || (array['Fall festival budget: MOTION to approve up to $2,500 (Patel/Johnson). Vote 5–1. CARRIED.',
                     'Park bench repairs: MOTION to authorize up to $1,200 from reserves (Brooks/Chen). Vote 4–0, 1 abstaining. CARRIED.',
                     'Holiday food drive: MOTION to approve $400 for supplies (Patel/Morgan). Vote 6–0. CARRIED.'])[v_m],
      '6. Adjourned.',
      '',
      'Respectfully submitted,',
      'Sam Chen, Secretary');
    insert into board.minutes (org_id, meeting_id, version, content, status, created_by, submitted_at,
        approved_by, approved_at)
    values (p_org, v_meeting, 1, v_minutes,
      case when v_m < 3 then 'approved'::board.minutes_status else 'submitted'::board.minutes_status end,
      p_owner, v_dates[v_m] + 3,
      case when v_m < 3 then p_owner end,
      case when v_m < 3 then v_dates[v_m + 1] end);

    -- Action items from each meeting.
    insert into board.action_items (org_id, meeting_id, title, details, assignee_id, due_date, status, created_by)
    values
      (p_org, v_meeting,
        (array['Book vendors and the bounce house', 'Get a signed contract for the bench repairs', 'Place collection boxes at four locations'])[v_m],
        (array['Owner: Priya Patel. Confirm by the end of the month.', 'Owner: Taylor Brooks. Use the lower of the two quotes.', 'Owner: Priya Patel. Library, school, pantry and the coffee shop.'])[v_m],
        null, v_dates[v_m] + 21,
        case when v_m < 3 then 'done'::board.task_status else 'in_progress'::board.task_status end, p_owner),
      (p_org, v_meeting,
        (array['Post the festival on the website and newsletter', 'Send renewal reminders to households in grace', 'Thank-you notes to festival volunteers'])[v_m],
        null, p_owner, v_dates[v_m] + 14,
        case when v_m = 1 then 'done'::board.task_status when v_m = 2 then 'done'::board.task_status else 'open'::board.task_status end, p_owner);
  end loop;

  -- Next meeting: scheduled, with last month's minutes up for approval.
  insert into board.meetings (org_id, title, meeting_date, start_time, location, status, created_by)
  values (p_org, 'Regular Board Meeting', v_dates[4], '18:30', 'Riverside Library, Community Room',
    'scheduled', p_owner)
  returning id into v_meeting;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, description, is_vote_item, proposed_motion) values
    (p_org, v_meeting, 0, 'Call to order', 'Alex Morgan', 5, null, false, null),
    (p_org, v_meeting, 1, 'Approval of minutes — ' || to_char(v_dates[3], 'FMMonth FMDD'), 'Sam Chen', 5,
      'The draft minutes are submitted and ready for approval.', true,
      'Approve the minutes of the ' || to_char(v_dates[3], 'FMMonth FMDD') || ' meeting as submitted.'),
    (p_org, v_meeting, 2, 'Treasurer''s report', 'Taylor Brooks', 10, 'Monthly statement and year-to-date budget.', false, null),
    (p_org, v_meeting, 3, 'Membership report', 'Jordan Lee', 10, null, false, null),
    (p_org, v_meeting, 4, 'Draft budget for next year', 'Taylor Brooks', 20,
      'The Finance Committee''s first draft, for discussion.', false, null),
    (p_org, v_meeting, 5, 'Adjournment', 'Alex Morgan', 5, null, false, null);
  insert into board.attendance (org_id, meeting_id, person_name, user_id, status, is_voting)
  values (p_org, v_meeting, 'Alex Morgan', p_owner, 'present', true);
  for v_i in 1..5 loop
    insert into board.attendance (org_id, meeting_id, person_name, person_id, status, is_voting)
    values (p_org, v_meeting, v_people[v_i], v_person[v_i], 'present', true);
  end loop;
  insert into board.action_items (org_id, title, details, assignee_id, due_date, status, created_by)
  values (p_org, 'Review the draft budget before the meeting', 'Shared by the Finance Committee.',
    p_owner, v_dates[4] - 2, 'open', p_owner);
end;
$$;

revoke all on function board.demo_fill(uuid, uuid) from public, anon, authenticated;

-- Fill now: through the hub's reset when it's there (it recreates the organization and calls
-- every app), otherwise create the two accounts and the organization here, once.
do $fill$
declare
  c_org constant uuid := 'de000000-0000-4000-8000-0000000000a1';
  c_demo constant uuid := 'de000000-0000-4000-8000-000000000001';
  c_test constant uuid := 'de000000-0000-4000-8000-000000000002';
  r record;
begin
  if to_regprocedure('hub.reset_suite_demo()') is not null then
    perform hub.reset_suite_demo();
    return;
  end if;
  if exists (select 1 from public.organizations where id = c_org) then
    if not exists (select 1 from board.meetings where org_id = c_org) then
      perform board.demo_fill(c_org, c_demo);
    end if;
    return;
  end if;
  for r in select * from (values
      (c_demo, 'demo@demo.openapphub.org', 'Alex Morgan'),
      (c_test, 'test@demo.openapphub.org', 'Test Account')) v(id, email, name) loop
    if not exists (select 1 from auth.users where id = r.id) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
        recovery_token, email_change_token_new, email_change, email_change_token_current,
        reauthentication_token, phone_change, phone_change_token)
      values ('00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email,
        extensions.crypt('OpenAppHubDemo2026', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.name),
        now(), now(), '', '', '', '', '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (r.id::text, r.id, jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
        'email', now(), now(), now());
    end if;
  end loop;
  insert into public.organizations (id, name, slug, created_by)
  values (c_org, 'Riverside Community Association', 'riverside-community-association', c_demo);
  insert into public.memberships (org_id, user_id, role) values (c_org, c_demo, 'owner');
  perform board.demo_fill(c_org, c_demo);
end
$fill$;
