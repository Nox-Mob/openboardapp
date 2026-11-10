-- OpenBoardApp demo data for STAGING (and local development) only. Applied by
-- scripts/migrate.mjs --seed (Migrate → staging), recorded under "openboardapp:seed",
-- so it runs once. Never on production: it refuses a database that isn't marked
-- staging by the hub, or (without the hub) one holding real organizations.
--
-- "Riverside Community Association" (fixed id d0000000-0000-0000-0000-000000000001),
-- five people, each in a different board position. Only one can sign in:
--   Pat Rivera     President        owner                president@riverside.example.org (no login)
--   Alex Morgan    Vice President   admin                board.demo@demo.openapphub.org / OpenBoardDemo!2026
--   Sam Chen       Secretary        member + secretary   secretary@riverside.example.org (no login)
--   Taylor Brooks  Treasurer        member + treasurer   treasurer@riverside.example.org (no login)
--   Jordan Lee     Member at Large  member               member@riverside.example.org    (no login)
-- The four non-login accounts have no password and are banned. example.org is
-- reserved, so no real person receives their mail. Dates are relative to the day the
-- seed runs: last month's meeting (completed, minutes submitted for approval) and next
-- week's (scheduled, minutes up for approval), positions and terms, committees, a
-- template and action items.
do $$
declare
  demo_org constant uuid := 'd0000000-0000-0000-0000-000000000001';
  p record;
  uid uuid;
  pat uuid; alex uuid; sam uuid; taylor uuid; jordan uuid;
  prev_date date := current_date - 28;
  next_date date := current_date + 7;
  prev_meeting uuid; next_meeting uuid;
  a_call uuid; a_minutes uuid; a_treasurer uuid; a_cleanup uuid; a_benches uuid; a_adjourn uuid;
  pos_president uuid; pos_vp uuid; pos_secretary uuid; pos_treasurer uuid; pos_mal uuid;
  finance uuid; events uuid;
  minutes_text text;
begin
  if to_regclass('hub.instance') is not null then
    if coalesce((select environment from hub.instance where id), '') <> 'staging' then
      raise exception 'Refusing to seed: this database is not marked staging.';
    end if;
  elsif exists (select 1 from public.organizations where id <> demo_org) then
    raise exception 'Refusing to seed: this database has real organizations.';
  end if;
  if exists (select 1 from public.organizations where id = demo_org) then
    return; -- already there
  end if;

  -- 1. The five accounts (core gives each a profile).
  for p in
    select * from (values
      ('d0000000-0000-4000-8000-0000000000a1'::uuid, 'president@riverside.example.org', 'Pat Rivera',    null::text),
      ('d0000000-0000-4000-8000-0000000000a2'::uuid, 'board.demo@demo.openapphub.org',  'Alex Morgan',   'OpenBoardDemo!2026'),
      ('d0000000-0000-4000-8000-0000000000a3'::uuid, 'secretary@riverside.example.org', 'Sam Chen',      null),
      ('d0000000-0000-4000-8000-0000000000a4'::uuid, 'treasurer@riverside.example.org', 'Taylor Brooks', null),
      ('d0000000-0000-4000-8000-0000000000a5'::uuid, 'member@riverside.example.org',    'Jordan Lee',    null)
    ) as v(id, email, full_name, password)
  loop
    select id into uid from auth.users where email = p.email;
    if uid is null then
      uid := p.id;
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token,
        banned_until
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p.email,
        case when p.password is null then '' else extensions.crypt(p.password, extensions.gen_salt('bf')) end,
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p.full_name), now(), now(),
        '', '', '', '', '', '', '', '',
        case when p.password is null then '2999-12-31'::timestamptz end
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, 'email',
              jsonb_build_object('sub', uid::text, 'email', p.email, 'email_verified', true), now(), now(), now());
    end if;
    case p.full_name
      when 'Pat Rivera' then pat := uid;
      when 'Alex Morgan' then alex := uid;
      when 'Sam Chen' then sam := uid;
      when 'Taylor Brooks' then taylor := uid;
      else jordan := uid;
    end case;
  end loop;

  -- 2. The organization (core), its people's roles and offices, and Board's settings.
  insert into public.organizations (id, name, slug, created_by)
  values (demo_org, 'Riverside Community Association', 'riverside-community-association-demo', pat);
  insert into public.memberships (org_id, user_id, role) values
    (demo_org, pat, 'owner'),
    (demo_org, alex, 'admin'),
    (demo_org, sam, 'member'),
    (demo_org, taylor, 'member'),
    (demo_org, jordan, 'member');
  insert into board.officers (org_id, user_id, office) values
    (demo_org, sam, 'secretary'),
    (demo_org, taylor, 'treasurer');
  insert into board.org_settings (org_id, timezone, quorum_count) values (demo_org, 'America/Chicago', 3);
  if to_regclass('hub.demo_orgs') is not null then
    execute 'insert into hub.demo_orgs (org_id, created_by) values ($1, $2) on conflict do nothing'
      using demo_org, alex;
  end if;

  -- 3. Board records (triggers on: same-org checks and audit apply as usual).
  insert into board.positions (org_id, title, term_years, sort_order) values (demo_org, 'President', 2, 0) returning id into pos_president;
  insert into board.positions (org_id, title, term_years, sort_order) values (demo_org, 'Vice President', 2, 1) returning id into pos_vp;
  insert into board.positions (org_id, title, term_years, sort_order) values (demo_org, 'Secretary', 2, 2) returning id into pos_secretary;
  insert into board.positions (org_id, title, term_years, sort_order) values (demo_org, 'Treasurer', 2, 3) returning id into pos_treasurer;
  insert into board.positions (org_id, title, term_years, sort_order) values (demo_org, 'Member at Large', 1, 4) returning id into pos_mal;

  insert into board.terms (org_id, person_name, user_id, position, position_id, start_date, notes) values
    (demo_org, 'Pat Rivera',    pat,    'President',       pos_president, date_trunc('year', current_date)::date - 365, 'Elected at the annual meeting.'),
    (demo_org, 'Alex Morgan',   alex,   'Vice President',  pos_vp,        date_trunc('year', current_date)::date - 365, null),
    (demo_org, 'Sam Chen',      sam,    'Secretary',       pos_secretary, date_trunc('year', current_date)::date, null),
    (demo_org, 'Taylor Brooks', taylor, 'Treasurer',       pos_treasurer, date_trunc('year', current_date)::date, null),
    (demo_org, 'Jordan Lee',    jordan, 'Member at Large', pos_mal,       date_trunc('year', current_date)::date, null);

  insert into board.committees (org_id, name, description)
  values (demo_org, 'Finance Committee', 'Prepares the annual budget and reviews monthly statements.') returning id into finance;
  insert into board.committees (org_id, name, description)
  values (demo_org, 'Events Committee', 'Plans the spring clean-up and the summer picnic.') returning id into events;
  insert into board.committee_members (org_id, committee_id, person_name, user_id, role) values
    (demo_org, finance, 'Taylor Brooks', taylor, 'Chair'),
    (demo_org, finance, 'Pat Rivera',    pat,    'Member'),
    (demo_org, events,  'Jordan Lee',    jordan, 'Chair'),
    (demo_org, events,  'Alex Morgan',   alex,   'Member');

  insert into board.meeting_templates (org_id, name, meeting_title, start_time, location, agenda, created_by)
  values (demo_org, 'Monthly board meeting', 'Regular Board Meeting', '18:30', 'Riverside Library, Community Room',
    '[{"title":"Call to order","duration_minutes":5},
      {"title":"Approval of previous minutes","duration_minutes":5,"is_vote_item":true,"proposed_motion":"Approve the minutes of the previous meeting as submitted."},
      {"title":"Treasurer''s report","duration_minutes":10},
      {"title":"Old business","duration_minutes":20},
      {"title":"New business","duration_minutes":20},
      {"title":"Adjournment","duration_minutes":5}]'::jsonb, pat);

  -- Last month's meeting: completed, minutes submitted and waiting for approval.
  insert into board.meetings (org_id, title, meeting_date, start_time, location, status, created_by)
  values (demo_org, 'Regular Board Meeting', prev_date, '18:30', 'Riverside Library, Community Room', 'completed', pat)
  returning id into prev_meeting;

  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 0, 'Call to order', 'Pat Rivera', 5, 'The President called the meeting to order at 6:32 PM.')
  returning id into a_call;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 1, 'Approval of previous minutes', 'Sam Chen', 5, 'The minutes of the prior meeting were approved as circulated, without corrections.')
  returning id into a_minutes;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 2, 'Treasurer''s report', 'Taylor Brooks', 10, 'Operating account balance $8,412.37; reserve fund $15,000.00. Dues collection is at 86%. The report was accepted as presented.')
  returning id into a_treasurer;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
  values (demo_org, prev_meeting, 3, 'Spring clean-up event', 'Jordan Lee', 15, 'Twenty-two volunteers have signed up. The city will lend trash grabbers and provide a dumpster at no cost.', true, 'Approve up to $300 for gloves, bags and refreshments for the spring clean-up.')
  returning id into a_cleanup;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
  values (demo_org, prev_meeting, 4, 'Park bench repairs', 'Taylor Brooks', 15, 'Three benches along the river trail have broken slats. Two contractor quotes were reviewed.', true, 'Authorize up to $1,200 from the reserve fund to repair three park benches.')
  returning id into a_benches;
  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 5, 'Adjournment', 'Pat Rivera', 5, 'There being no further business, the meeting was adjourned at 7:41 PM.')
  returning id into a_adjourn;

  insert into board.attendance (org_id, meeting_id, person_name, user_id, status, is_voting) values
    (demo_org, prev_meeting, 'Pat Rivera',    pat,    'present', true),
    (demo_org, prev_meeting, 'Alex Morgan',   alex,   'present', true),
    (demo_org, prev_meeting, 'Sam Chen',      sam,    'present', true),
    (demo_org, prev_meeting, 'Taylor Brooks', taylor, 'present', true),
    (demo_org, prev_meeting, 'Jordan Lee',    jordan, 'remote',  true);

  insert into board.motions (org_id, meeting_id, agenda_item_id, motion_text, moved_by, seconded_by, votes_yes, votes_no, votes_abstain, outcome) values
    (demo_org, prev_meeting, a_cleanup, 'Approve up to $300 for gloves, bags and refreshments for the spring clean-up', 'Jordan Lee', 'Alex Morgan', 5, 0, 0, 'carried'),
    (demo_org, prev_meeting, a_benches, 'Authorize up to $1,200 from the reserve fund to repair three park benches', 'Taylor Brooks', 'Sam Chen', 4, 0, 1, 'carried');

  minutes_text := concat_ws(E'\n',
    'RIVERSIDE COMMUNITY ASSOCIATION',
    'Minutes of Regular Board Meeting',
    prev_date::text || ' · 18:30 · Riverside Library, Community Room',
    '',
    'Present: Pat Rivera, Alex Morgan, Sam Chen, Taylor Brooks, Jordan Lee (remote)',
    'A quorum was present (5 of 3 required).',
    '',
    '1. Call to order — Pat Rivera',
    'The President called the meeting to order at 6:32 PM.',
    '',
    '2. Approval of previous minutes — Sam Chen',
    'The minutes of the prior meeting were approved as circulated, without corrections.',
    '',
    '3. Treasurer''s report — Taylor Brooks',
    'Operating account balance $8,412.37; reserve fund $15,000.00. Dues collection is at 86%. The report was accepted as presented.',
    '',
    '4. Spring clean-up event — Jordan Lee',
    'Twenty-two volunteers have signed up. The city will lend trash grabbers and provide a dumpster at no cost.',
    'MOTION: Approve up to $300 for gloves, bags and refreshments for the spring clean-up (Moved by Jordan Lee, seconded by Alex Morgan). Vote: 5 in favor, 0 opposed, 0 abstaining. CARRIED.',
    '',
    '5. Park bench repairs — Taylor Brooks',
    'Three benches along the river trail have broken slats. Two contractor quotes were reviewed.',
    'MOTION: Authorize up to $1,200 from the reserve fund to repair three park benches (Moved by Taylor Brooks, seconded by Sam Chen). Vote: 4 in favor, 0 opposed, 1 abstaining. CARRIED.',
    '',
    '6. Adjournment — Pat Rivera',
    'There being no further business, the meeting was adjourned at 7:41 PM.',
    '',
    'Respectfully submitted,',
    'Secretary');

  insert into board.minutes (org_id, meeting_id, version, content, status, created_by, submitted_at)
  values (demo_org, prev_meeting, 1, minutes_text, 'submitted', sam, now() - interval '20 days');

  -- Next week's meeting: scheduled, with the minutes up for approval.
  insert into board.meetings (org_id, title, meeting_date, start_time, location, status, created_by)
  values (demo_org, 'Regular Board Meeting', next_date, '18:30', 'Riverside Library, Community Room', 'scheduled', pat)
  returning id into next_meeting;

  insert into board.agenda_items (org_id, meeting_id, position, title, presenter, duration_minutes, description, is_vote_item, proposed_motion) values
    (demo_org, next_meeting, 0, 'Call to order', 'Pat Rivera', 5, null, false, null),
    (demo_org, next_meeting, 1, 'Approval of minutes — Regular Board Meeting, ' || to_char(prev_date, 'FMMonth FMDD, YYYY'), 'Sam Chen', 5,
       'The draft minutes have been submitted by the Secretary and are ready for approval.', true,
       'Approve the minutes of the ' || to_char(prev_date, 'FMMonth FMDD, YYYY') || ' Regular Board Meeting as submitted.'),
    (demo_org, next_meeting, 2, 'Treasurer''s report', 'Taylor Brooks', 10, 'Monthly statement and dues update.', false, null),
    (demo_org, next_meeting, 3, 'Park bench repairs — update', 'Taylor Brooks', 10, 'Contractor scheduled; work to finish before the picnic.', false, null),
    (demo_org, next_meeting, 4, 'Summer picnic', 'Jordan Lee', 15, 'Pavilion reservation, food and permits.', true,
       'Approve a budget of $750 for the summer picnic.'),
    (demo_org, next_meeting, 5, 'Adjournment', 'Pat Rivera', 5, null, false, null);

  insert into board.attendance (org_id, meeting_id, person_name, user_id, status, is_voting) values
    (demo_org, next_meeting, 'Pat Rivera',    pat,    'present', true),
    (demo_org, next_meeting, 'Alex Morgan',   alex,   'present', true),
    (demo_org, next_meeting, 'Sam Chen',      sam,    'present', true),
    (demo_org, next_meeting, 'Taylor Brooks', taylor, 'present', true),
    (demo_org, next_meeting, 'Jordan Lee',    jordan, 'present', true);

  insert into board.action_items (org_id, meeting_id, title, details, assignee_id, due_date, status, created_by) values
    (demo_org, prev_meeting, 'Get a signed contract for the bench repairs', 'Use the lower of the two quotes.', taylor, next_date, 'in_progress', pat),
    (demo_org, prev_meeting, 'Buy clean-up supplies', 'Gloves, bags and water; keep receipts for the Treasurer.', jordan, prev_date + 14, 'done', pat),
    (demo_org, prev_meeting, 'Post approved minutes on the association website', null, sam, next_date + 3, 'open', pat),
    (demo_org, null, 'Draft the volunteer sign-up form for the summer picnic', 'Share a draft with the Events Committee before the next meeting.', alex, next_date - 2, 'open', pat);
end $$;
