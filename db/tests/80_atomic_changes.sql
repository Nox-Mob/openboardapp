-- B-11: multi-step changes are one call each, so a failure leaves nothing half-done.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@atomic.org', '{"full_name":"Olive Owner"}');
  member uuid := tests.create_user('member@atomic.org', '{"full_name":"Max Member"}');
  outsider uuid := tests.create_user('out@atomic.org');
  org uuid; mtg uuid; pos uuid; t1 uuid; t2 uuid; doc uuid := gen_random_uuid();
begin
  perform tests.as_user(owner);
  org := public.create_organization('Atomic Board');
  perform tests.add_member(org, member, 'member');

  -- A meeting and its agenda.
  perform tests.as_user(owner);
  mtg := board.create_meeting_with_agenda(org, 'Regular', '2026-12-01', '6:30 PM', 'Library',
    '[{"title":"Call to order"},{"title":"  "},{"title":"Budget","presenter":"Tess","duration_minutes":20,"is_vote_item":true,"proposed_motion":"Adopt it"}]');
  perform tests.ok((select status = 'scheduled' and created_by = owner from board.meetings where id = mtg), 'meeting scheduled, by the caller');
  perform tests.ok(tests.count(format('select * from board.agenda_items where meeting_id = %L', mtg)) = 2, 'blank agenda items are skipped');
  perform tests.ok((select position = 1 and presenter = 'Tess' and duration_minutes = 20 and is_vote_item
                    from board.agenda_items where meeting_id = mtg and title = 'Budget'), 'agenda details and order kept');
  perform tests.throws(format($q$select board.create_meeting_with_agenda(%L, 'Broken', '2026-12-02', null, null, '[{"title":"A"},{"title":"B","is_vote_item":"maybe"}]')$q$, org),
    'a bad agenda item fails the whole call', 'boolean');
  perform tests.ok(tests.count(format('select * from board.meetings where org_id = %L and title = %L', org, 'Broken')) = 0,
    'no meeting is left without its agenda');
  perform tests.as_user(member);
  perform tests.throws(format($q$select board.create_meeting_with_agenda(%L, 'Sneaky', '2026-12-03')$q$, org),
    'members cannot schedule meetings', 'row-level security');
  perform tests.as_user(outsider);
  perform tests.throws(format($q$select board.create_meeting_with_agenda(%L, 'Outside', '2026-12-03')$q$, org),
    'outsiders cannot schedule meetings', 'row-level security');

  -- Closing a term and starting the next.
  perform tests.as_user(owner);
  insert into board.positions (org_id, title, term_years) values (org, 'Treasurer', 2) returning id into pos;
  t1 := board.assign_term(org, pos, 'Treasurer', 'Tess First', null, '2025-01-01', null);
  t2 := board.assign_term(org, pos, 'Treasurer', 'Tom Second', member, '2026-01-01', '2027-12-31');
  perform tests.ok((select end_date = '2025-12-31' from board.terms where id = t1), 'the open term ends the day before');
  perform tests.ok((select user_id = member and end_date = '2027-12-31' from board.terms where id = t2), 'the new term starts');
  perform tests.throws(format($q$select board.assign_term(%L, %L, 'Treasurer', null, null, '2027-01-01')$q$, org, pos),
    'a bad new term fails the whole call', 'null value');
  perform tests.ok((select end_date = '2027-12-31' from board.terms where id = t2), 'the current term is untouched when the next one fails');
  perform tests.throws(format($q$select board.assign_term(%L, %L, 'Treasurer', 'X', null, '2027-01-01', '2026-01-01')$q$, org, pos),
    'end before start refused', 'end before it starts');

  -- A document and its first version.
  perform board.add_document(doc, org, 'Bylaws', '', null, org || '/documents/' || doc || '/v1-bylaws.pdf', 'bylaws.pdf', 'application/pdf', 1234);
  perform tests.ok((select category = 'General' from board.documents where id = doc), 'category defaults to General');
  perform tests.ok((select version = 1 and size_bytes = 1234 and uploaded_by = owner from board.document_versions where document_id = doc),
    'the first version is recorded');
  perform tests.throws(format($q$select board.add_document(gen_random_uuid(), %L, 'Bad', 'General', null, null, 'x.pdf', '', 1)$q$, org),
    'a bad version fails the whole call', 'null value');
  perform tests.ok(tests.count(format('select * from board.documents where org_id = %L and title = %L', org, 'Bad')) = 0,
    'no document is left without its file');
end
$$;
rollback;
