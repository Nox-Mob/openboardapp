-- Two-app check for the Charter ⇄ Board sync (S-14). Needs OpenCharterApp's migrations and test
-- helpers on the same database: supabase stub, Charter's migrate, Board's migrate, then
--   psql $URL -f <opencharterapp>/db/tests/00_helpers.sql -f db/suite/charter_sync.sql
\set ON_ERROR_STOP 1
begin;
select tests.fixture();
-- officers don't need a membership here; Nat has President and Treasurer seats
insert into charter.org_settings (unit_id, key, value, mode) values ('22222222-0000-4000-8000-000000000001', 'governance.officers_good_standing', 'false', 'override');
insert into charter.seat_templates (id, unit_id, key, title, scope) values
  ('44444444-0000-4000-8000-000000000091', '22222222-0000-4000-8000-000000000001', 'president', 'President', 'self'),
  ('44444444-0000-4000-8000-000000000092', '22222222-0000-4000-8000-000000000001', 'treasurer', 'Treasurer', 'self');
insert into charter.member_profiles (id, unit_id, display_name, email, source) values
  ('33333333-0000-4000-8000-000000000091', '22222222-0000-4000-8000-000000000001', 'Pat Treasurer', 'pat@test.org', 'admin')
  on conflict do nothing;
update charter.member_profiles set display_name = 'Nora National' where id = '33333333-0000-4000-8000-000000000001';

-- 1. Charter appoints: Board gets the term.
select tests.as_user('11111111-0000-4000-8000-000000000001');
select charter.appoint_officer('22222222-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000091', '33333333-0000-4000-8000-000000000001', '2026-01-01') as appt \gset
select tests.reset_role();
select tests.eq((select person_name || ' / ' || position || ' / ' || source from board.terms where source_id = :'appt'), 'Nora National / President / charter', '1. Charter appointment mirrored in Board');

-- 2. Board can't rename a mirrored term.
select tests.as_user('11111111-0000-4000-8000-000000000001');
select tests.throws($$update board.terms set position = 'Chair' where source = 'charter'$$, 'OpenCharterApp');
-- 3. Board ends it (today): the Charter appointment ends.
update board.terms set end_date = current_date where source_id = :'appt';
select tests.reset_role();
select tests.eq((select ended_on from charter.appointments where id = :'appt'), current_date, '3. ending the term in Board ends the Charter appointment');

-- 4. Board adds a Treasurer term for a Charter member: Charter gets the appointment.
select tests.as_user('11111111-0000-4000-8000-000000000001');
insert into board.terms (org_id, person_name, position, start_date) values ('22222222-0000-4000-8000-000000000001', 'Pat Treasurer', 'treasurer', '2026-02-01');
-- 5. And a position Charter doesn't have stays Board-only.
insert into board.terms (org_id, person_name, position, start_date) values ('22222222-0000-4000-8000-000000000001', 'Guest Advisor', 'Advisor', '2026-02-01');
select tests.reset_role();
select tests.eq((select count(*) from charter.appointments where template_id = '44444444-0000-4000-8000-000000000092' and ended_on is null), 1::bigint, '4. a Board term with a Charter seat and member becomes an appointment');
select tests.eq((select count(*) from board.terms where person_name = 'Pat Treasurer'), 1::bigint, '4b. no echo: still one Board term');
select tests.eq((select source from board.terms where person_name = 'Pat Treasurer'), 'charter', '4c. and it is marked as linked');
select tests.eq((select source is null from board.terms where person_name = 'Guest Advisor'), true, '5. an unmatched term stays Board-only');

-- 6. Charter ends the treasurer: Board's term gets the end date.
select tests.as_user('11111111-0000-4000-8000-000000000001');
select charter.end_appointment((select id from charter.appointments where template_id = '44444444-0000-4000-8000-000000000092' and ended_on is null), 'stepped down', current_date);
select tests.reset_role();
select tests.eq((select end_date from board.terms where person_name = 'Pat Treasurer'), current_date, '6. ending in Charter ends the Board term');

-- 7. Chapter seats don't go to Board.
insert into charter.seat_templates (id, unit_id, key, title, scope) values
  ('44444444-0000-4000-8000-000000000093', '22222222-0000-4000-8000-000000000002', 'chair', 'Chapter Chair', 'self');
select tests.as_user('11111111-0000-4000-8000-000000000002');
select charter.appoint_officer('22222222-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000093', '33333333-0000-4000-8000-000000000002', '2026-01-01');
select tests.reset_role();
select tests.eq((select count(*) from board.terms where position = 'Chapter Chair'), 0::bigint, '7. chapter officers stay in Charter (no OpenBoardApp for the chapter yet)');

-- 8. The national lets chapters use OpenBoardApp; Chapter A turns it on: its own organization,
--    with its current officers already on its board.
insert into charter.org_settings (unit_id, key, value) values ('22222222-0000-4000-8000-000000000001', 'board.chapters', '"open"');
select tests.as_user('11111111-0000-4000-8000-000000000002');
select charter.request_chapter_board('22222222-0000-4000-8000-000000000002');
select tests.reset_role();
select charter.board_org_for_unit('22222222-0000-4000-8000-000000000002') as chap_org \gset
select tests.eq((select person_name || ' / ' || position from board.terms where org_id = :'chap_org' and source = 'charter'),
  'a@test.org / Chapter Chair', '8. the chapter''s officer is on the chapter''s own board');
select tests.eq((select count(*) from board.terms where org_id = '22222222-0000-4000-8000-000000000001' and position = 'Chapter Chair'), 0::bigint,
  '8b. and not on the national''s');

-- 9. A new chapter appointment reaches the chapter's board.
insert into charter.seat_templates (id, unit_id, key, title, scope) values
  ('44444444-0000-4000-8000-000000000094', '22222222-0000-4000-8000-000000000002', 'secretary', 'Chapter Secretary', 'self');
select tests.as_user('11111111-0000-4000-8000-000000000002');
select charter.appoint_officer('22222222-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000094', '33333333-0000-4000-8000-000000000003', '2026-03-01') as chap_appt \gset
select tests.reset_role();
select tests.eq((select org_id from board.terms where source_id = :'chap_appt'), :'chap_org'::uuid, '9. a new chapter appointment goes to the chapter''s board');

-- 10. Ending it on the chapter's board ends it in Charter.
select tests.as_user('11111111-0000-4000-8000-000000000002');
update board.terms set end_date = current_date where source_id = :'chap_appt';
select tests.reset_role();
select tests.eq((select ended_on from charter.appointments where id = :'chap_appt'), current_date, '10. ending it in the chapter''s Board ends the Charter appointment');
rollback;
\echo ALL SYNC CHECKS PASSED
