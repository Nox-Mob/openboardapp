-- Demo organization, rebuilt every 6 hours.
--
-- "Riverside Community Association" (fixed id d0000000-0000-0000-0000-000000000001)
-- has five people, each in a different board position. Only one can sign in:
--   Pat Rivera     President        owner          president@riverside.example.org  (no login)
--   Alex Morgan    Vice President   admin          demo@demo.org / OpenBoardDemo!2026  ← the demo login
--   Sam Chen       Secretary        secretary      secretary@riverside.example.org  (no login)
--   Taylor Brooks  Treasurer        treasurer      treasurer@riverside.example.org  (no login)
--   Jordan Lee     Member at Large  member         member@riverside.example.org     (no login)
-- The four non-login accounts have no password and are banned, so neither a
-- password, a magic link nor an OTP can sign them in. example.org is reserved, so
-- no real person ever receives their mail.
--
-- Contents (dates relative to each reset, so the demo never goes stale):
--   * last month's Regular Board Meeting: completed, with agenda, attendance, two
--     carried motions and minutes in "submitted" status, ready for approval;
--   * next week's Regular Board Meeting: scheduled, with "Approval of minutes" as a
--     vote item and its motion pre-filled, plus attendance roster;
--   * board positions and terms, two committees, a meeting template, action items.
--
-- public.reset_demo() rebuilds all of that. pg_cron runs it every 6 hours
-- (00:00, 06:00, 12:00, 18:00 UTC), and this migration runs it once to seed.
-- To wipe the demo org, which may hold records the app makes permanent (approved
-- minutes, cast votes, distributed packets), it disables the user triggers (record
-- locks, immutability, audit) on the organization tables with ALTER TABLE, which is
-- transactional: they are back on when the transaction commits or fails, and other
-- writers wait on the table locks meanwhile. Foreign keys stay on, so deleting the
-- organization cascades to its rows; ballots and electorates, whose foreign keys
-- deliberately block deletion, are removed first. It also removes organizations the demo account created (unless
-- someone outside the demo has joined them) and the demo account's memberships in
-- other organizations, and restores the demo account's password, name, email and
-- ban status and drops any MFA factor enrolled on it. Files uploaded to storage by
-- demo users are not deleted (only their metadata rows are).

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.reset_demo()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  demo_org constant uuid := 'd0000000-0000-0000-0000-000000000001';
  p record;
  uid uuid;
  pat uuid; alex uuid; sam uuid; taylor uuid; jordan uuid;
  people uuid[];
  purge uuid[];
  t text;
  org_tables text[];
  prev_date date := current_date - 28;
  next_date date := current_date + 7;
  prev_meeting uuid; next_meeting uuid;
  a_call uuid; a_minutes uuid; a_treasurer uuid; a_cleanup uuid; a_benches uuid; a_adjourn uuid;
  pos_president uuid; pos_vp uuid; pos_secretary uuid; pos_treasurer uuid; pos_mal uuid;
  finance uuid; events uuid;
  minutes_text text;
begin
  -- 1. The five accounts: create or restore (stable ids, found by email first).
  for p in
    select * from (values
      ('d0000000-0000-4000-8000-0000000000a1'::uuid, 'president@riverside.example.org', 'Pat Rivera',    null::text),
      ('d0000000-0000-4000-8000-0000000000a2'::uuid, 'demo@demo.org',                   'Alex Morgan',   'OpenBoardDemo!2026'),
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
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p.email,
        case when p.password is null then '' else extensions.crypt(p.password, extensions.gen_salt('bf')) end,
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p.full_name), now(), now(),
        '', '', '', '', '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, 'email',
              jsonb_build_object('sub', uid::text, 'email', p.email, 'email_verified', true), now(), now(), now());
    end if;
    -- Restore everything a demo visitor could have changed through the auth API.
    update auth.users set
      encrypted_password = case when p.password is null then '' else extensions.crypt(p.password, extensions.gen_salt('bf')) end,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      email_change = '', email_change_token_new = '', email_change_token_current = '',
      raw_user_meta_data = jsonb_build_object('full_name', p.full_name),
      banned_until = case when p.password is null then '2999-12-31'::timestamptz end,
      updated_at = now()
    where id = uid;
    delete from auth.mfa_factors where user_id = uid;
    insert into public.profiles (id, full_name, email) values (uid, p.full_name, p.email)
    on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

    case p.full_name
      when 'Pat Rivera' then pat := uid;
      when 'Alex Morgan' then alex := uid;
      when 'Sam Chen' then sam := uid;
      when 'Taylor Brooks' then taylor := uid;
      else jordan := uid;
    end case;
  end loop;
  people := array[pat, alex, sam, taylor, jordan];

  -- 2. Wipe: the demo org, plus orgs the demo login created that nobody else joined.
  select array_agg(o.id) into purge
  from public.organizations o
  where o.id = demo_org
     or (o.created_by = alex and not exists (
           select 1 from public.memberships m
           where m.organization_id = o.id and m.user_id <> all(people)));

  select array_agg(c.relname::text order by c.relname) || array['organizations'] into org_tables
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and a.attname = 'organization_id' and not a.attisdropped;

  foreach t in array org_tables loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;
  delete from public.member_votes where organization_id = any(purge);
  delete from public.vote_electorate where organization_id = any(purge);
  delete from public.organizations where id = any(purge);
  foreach t in array org_tables loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  -- The demo login leaves any real organization it was invited into (audited there).
  delete from public.memberships where user_id = alex;

  -- 3. Rebuild (triggers on: same-org checks and audit apply as usual).
  insert into public.organizations (id, name, timezone, quorum_count, created_by)
  values (demo_org, 'Riverside Community Association', 'America/Chicago', 3, pat);

  insert into public.memberships (organization_id, user_id, role) values
    (demo_org, pat, 'owner'),
    (demo_org, alex, 'admin'),
    (demo_org, sam, 'secretary'),
    (demo_org, taylor, 'treasurer'),
    (demo_org, jordan, 'member');

  insert into public.board_positions (organization_id, title, term_years, sort_order) values (demo_org, 'President', 2, 0) returning id into pos_president;
  insert into public.board_positions (organization_id, title, term_years, sort_order) values (demo_org, 'Vice President', 2, 1) returning id into pos_vp;
  insert into public.board_positions (organization_id, title, term_years, sort_order) values (demo_org, 'Secretary', 2, 2) returning id into pos_secretary;
  insert into public.board_positions (organization_id, title, term_years, sort_order) values (demo_org, 'Treasurer', 2, 3) returning id into pos_treasurer;
  insert into public.board_positions (organization_id, title, term_years, sort_order) values (demo_org, 'Member at Large', 1, 4) returning id into pos_mal;

  insert into public.board_terms (organization_id, person_name, user_id, position, position_id, start_date, notes) values
    (demo_org, 'Pat Rivera',    pat,    'President',       pos_president, date_trunc('year', current_date)::date - 365, 'Elected at the annual meeting.'),
    (demo_org, 'Alex Morgan',   alex,   'Vice President',  pos_vp,        date_trunc('year', current_date)::date - 365, null),
    (demo_org, 'Sam Chen',      sam,    'Secretary',       pos_secretary, date_trunc('year', current_date)::date, null),
    (demo_org, 'Taylor Brooks', taylor, 'Treasurer',       pos_treasurer, date_trunc('year', current_date)::date, null),
    (demo_org, 'Jordan Lee',    jordan, 'Member at Large', pos_mal,       date_trunc('year', current_date)::date, null);

  insert into public.committees (organization_id, name, description)
  values (demo_org, 'Finance Committee', 'Prepares the annual budget and reviews monthly statements.') returning id into finance;
  insert into public.committees (organization_id, name, description)
  values (demo_org, 'Events Committee', 'Plans the spring clean-up and the summer picnic.') returning id into events;
  insert into public.committee_members (organization_id, committee_id, person_name, user_id, role) values
    (demo_org, finance, 'Taylor Brooks', taylor, 'Chair'),
    (demo_org, finance, 'Pat Rivera',    pat,    'Member'),
    (demo_org, events,  'Jordan Lee',    jordan, 'Chair'),
    (demo_org, events,  'Alex Morgan',   alex,   'Member');

  insert into public.meeting_templates (organization_id, name, meeting_title, start_time, location, agenda, created_by)
  values (demo_org, 'Monthly board meeting', 'Regular Board Meeting', '18:30', 'Riverside Library, Community Room',
    '[{"title":"Call to order","duration_minutes":5},
      {"title":"Approval of previous minutes","duration_minutes":5,"is_vote_item":true,"proposed_motion":"Approve the minutes of the previous meeting as submitted."},
      {"title":"Treasurer''s report","duration_minutes":10},
      {"title":"Old business","duration_minutes":20},
      {"title":"New business","duration_minutes":20},
      {"title":"Adjournment","duration_minutes":5}]'::jsonb, pat);

  -- Last month's meeting: completed, minutes submitted and waiting for approval.
  insert into public.meetings (organization_id, title, meeting_date, start_time, location, status, created_by)
  values (demo_org, 'Regular Board Meeting', prev_date, '18:30', 'Riverside Library, Community Room', 'completed', pat)
  returning id into prev_meeting;

  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 0, 'Call to order', 'Pat Rivera', 5, 'The President called the meeting to order at 6:32 PM.')
  returning id into a_call;
  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 1, 'Approval of previous minutes', 'Sam Chen', 5, 'The minutes of the prior meeting were approved as circulated, without corrections.')
  returning id into a_minutes;
  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 2, 'Treasurer''s report', 'Taylor Brooks', 10, 'Operating account balance $8,412.37; reserve fund $15,000.00. Dues collection is at 86%. The report was accepted as presented.')
  returning id into a_treasurer;
  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
  values (demo_org, prev_meeting, 3, 'Spring clean-up event', 'Jordan Lee', 15, 'Twenty-two volunteers have signed up. The city will lend trash grabbers and provide a dumpster at no cost.', true, 'Approve up to $300 for gloves, bags and refreshments for the spring clean-up.')
  returning id into a_cleanup;
  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, notes, is_vote_item, proposed_motion)
  values (demo_org, prev_meeting, 4, 'Park bench repairs', 'Taylor Brooks', 15, 'Three benches along the river trail have broken slats. Two contractor quotes were reviewed.', true, 'Authorize up to $1,200 from the reserve fund to repair three park benches.')
  returning id into a_benches;
  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, notes)
  values (demo_org, prev_meeting, 5, 'Adjournment', 'Pat Rivera', 5, 'There being no further business, the meeting was adjourned at 7:41 PM.')
  returning id into a_adjourn;

  insert into public.attendance (organization_id, meeting_id, person_name, user_id, status, is_voting) values
    (demo_org, prev_meeting, 'Pat Rivera',    pat,    'present', true),
    (demo_org, prev_meeting, 'Alex Morgan',   alex,   'present', true),
    (demo_org, prev_meeting, 'Sam Chen',      sam,    'present', true),
    (demo_org, prev_meeting, 'Taylor Brooks', taylor, 'present', true),
    (demo_org, prev_meeting, 'Jordan Lee',    jordan, 'remote',  true);

  insert into public.motions (organization_id, meeting_id, agenda_item_id, motion_text, moved_by, seconded_by, votes_yes, votes_no, votes_abstain, outcome) values
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

  insert into public.minutes (organization_id, meeting_id, version, content, status, created_by, submitted_at)
  values (demo_org, prev_meeting, 1, minutes_text, 'submitted', sam, now() - interval '20 days');

  -- Next week's meeting: scheduled, with the minutes up for approval.
  insert into public.meetings (organization_id, title, meeting_date, start_time, location, status, created_by)
  values (demo_org, 'Regular Board Meeting', next_date, '18:30', 'Riverside Library, Community Room', 'scheduled', pat)
  returning id into next_meeting;

  insert into public.agenda_items (organization_id, meeting_id, position, title, presenter, duration_minutes, description, is_vote_item, proposed_motion) values
    (demo_org, next_meeting, 0, 'Call to order', 'Pat Rivera', 5, null, false, null),
    (demo_org, next_meeting, 1, 'Approval of minutes — Regular Board Meeting, ' || to_char(prev_date, 'FMMonth FMDD, YYYY'), 'Sam Chen', 5,
       'The draft minutes have been submitted by the Secretary and are ready for approval.', true,
       'Approve the minutes of the ' || to_char(prev_date, 'FMMonth FMDD, YYYY') || ' Regular Board Meeting as submitted.'),
    (demo_org, next_meeting, 2, 'Treasurer''s report', 'Taylor Brooks', 10, 'Monthly statement and dues update.', false, null),
    (demo_org, next_meeting, 3, 'Park bench repairs — update', 'Taylor Brooks', 10, 'Contractor scheduled; work to finish before the picnic.', false, null),
    (demo_org, next_meeting, 4, 'Summer picnic', 'Jordan Lee', 15, 'Pavilion reservation, food and permits.', true,
       'Approve a budget of $750 for the summer picnic.'),
    (demo_org, next_meeting, 5, 'Adjournment', 'Pat Rivera', 5, null, false, null);

  insert into public.attendance (organization_id, meeting_id, person_name, user_id, status, is_voting) values
    (demo_org, next_meeting, 'Pat Rivera',    pat,    'present', true),
    (demo_org, next_meeting, 'Alex Morgan',   alex,   'present', true),
    (demo_org, next_meeting, 'Sam Chen',      sam,    'present', true),
    (demo_org, next_meeting, 'Taylor Brooks', taylor, 'present', true),
    (demo_org, next_meeting, 'Jordan Lee',    jordan, 'present', true);

  insert into public.action_items (organization_id, meeting_id, title, details, assignee_id, due_date, status, created_by) values
    (demo_org, prev_meeting, 'Get a signed contract for the bench repairs', 'Use the lower of the two quotes.', taylor, next_date, 'in_progress', pat),
    (demo_org, prev_meeting, 'Buy clean-up supplies', 'Gloves, bags and water; keep receipts for the Treasurer.', jordan, prev_date + 14, 'done', pat),
    (demo_org, prev_meeting, 'Post approved minutes on the association website', null, sam, next_date + 3, 'open', pat),
    (demo_org, null, 'Draft the volunteer sign-up form for the summer picnic', 'Share a draft with the Events Committee before the next meeting.', alex, next_date - 2, 'open', pat);
end $$;

revoke all on function public.reset_demo() from public, anon, authenticated;

-- Every 6 hours. cron.schedule replaces an existing job with the same name.
select cron.schedule('reset-demo-org', '0 */6 * * *', $$select public.reset_demo()$$);

-- Seed now.
select public.reset_demo();
