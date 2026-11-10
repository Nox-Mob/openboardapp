-- Live voting: opening, casting, closing, the official record, privacy, and the
-- read-only rule.
begin;
do $$
declare
  owner uuid := tests.create_user('owner@a.org', '{"full_name":"Olive Owner"}');
  chair uuid := tests.create_user('chair@a.org', '{"full_name":"Cleo Chair"}');
  m1 uuid := tests.create_user('m1@a.org', '{"full_name":"Mia One"}');
  m2 uuid := tests.create_user('m2@a.org', '{"full_name":"Mo Two"}');
  late uuid := tests.create_user('late@a.org', '{"full_name":"Lee Late"}');
  outsider uuid := tests.create_user('out@b.org');
  org uuid; mtg uuid; item uuid; mo uuid; mo2 uuid; mo3 uuid; r text;
begin
  perform tests.as_user(owner);
  org := public.create_organization('Alpha Board');
  perform tests.add_member(org, chair, 'member');
  perform tests.add_member(org, m1, 'member');
  perform tests.add_member(org, m2, 'member');
  perform tests.add_member(org, late, 'member');
  perform tests.as_user(owner);
  insert into board.officers (org_id, user_id, office) values (org, chair, 'chair');
  insert into board.org_settings (org_id, quorum_count, seconder_required, vote_close_modes)
  values (org, 3, true, '{chair}');
  insert into board.meetings (org_id, title, meeting_date, status) values (org, 'Regular', '2026-11-20', 'scheduled') returning id into mtg;
  insert into board.attendance (org_id, meeting_id, person_name, user_id) values
    (org, mtg, 'Cleo Chair', chair), (org, mtg, 'Mia One', m1), (org, mtg, 'Mo Two', m2), (org, mtg, 'Guest', null);

  perform tests.as_user(chair);
  perform tests.throws(format('select board.start_vote(%L, null, %L, %L, %L)', mtg, 'Adopt budget', 'Mia', 'Mo'),
    'votes open only while the meeting is in progress', 'in progress');
  update board.meetings set status = 'in_progress' where id = mtg;
  perform tests.throws(format('select board.start_vote(%L, null, %L, %L, null)', mtg, 'Adopt budget', 'Mia'),
    'a seconder is required when the org says so', 'seconder');
  mo := board.start_vote(mtg, null, 'Adopt budget', 'Mia', 'Mo');
  perform tests.ok((select vote_record ->> 'present_not_linked' from board.motions where id = mo) = '["Guest"]', 'unlinked attendees are noted');
  perform tests.throws(format('select board.start_vote(%L, null, %L, %L, %L)', mtg, 'Second', 'Mia', 'Mo'),
    'only one vote open at a time', 'already open');

  -- Someone marked present after the vote opened isn't on the voter list.
  insert into board.attendance (org_id, meeting_id, person_name, user_id) values (org, mtg, 'Lee Late', late);
  perform tests.as_user(late);
  perform tests.throws(format('select board.cast_vote(%L, %L)', mo, 'yes'), 'a late arrival cannot vote', 'not on the voter list');

  -- One vote each; never repeated, changed or deleted (even by the owner).
  perform tests.as_user(m1);
  perform tests.ok(board.cast_vote(mo, 'yes') = 'recorded', 'a member votes');
  perform tests.throws(format('select board.cast_vote(%L, %L)', mo, 'no'), 'a vote cannot be repeated', 'already voted');
  perform tests.as_user(m2);
  r := board.cast_vote(mo, 'no');
  -- Others can't see how someone voted until the vote closes.
  perform tests.ok(tests.count(format('select * from board.member_votes where motion_id = %L', mo)) = 1, 'a member sees only their own vote while open');
  perform tests.as_super();
  perform tests.throws(format('update board.member_votes set vote = %L where motion_id = %L', 'yes', mo), 'votes cannot be changed, even by the database owner', 'can never be changed');
  perform tests.throws(format('delete from board.member_votes where motion_id = %L', mo), 'votes cannot be deleted', 'can never be changed');

  -- Live-voted motions change only through the voting functions.
  perform tests.as_user(owner);
  perform tests.throws(format('update board.motions set outcome = %L where id = %L', 'carried', mo), 'a live motion cannot be edited directly', 'voting process');
  perform tests.throws(format('delete from board.motions where id = %L', mo), 'a live motion cannot be deleted directly', 'voting process');

  -- Closing: a plain member can't; the chair can. The record has counts and non-voters.
  perform tests.as_user(m1);
  perform tests.throws(format('select board.close_vote(%L)', mo), 'a member without a closing role cannot close', 'can''t close');
  perform tests.as_user(chair);
  perform board.close_vote(mo);
  perform tests.ok((select votes_yes = 1 and votes_no = 1 and voting_status = 'closed' from board.motions where id = mo), 'counts recorded');
  perform tests.ok((select vote_record -> 'not_voting' from board.motions where id = mo) = '["Cleo Chair"]', 'non-voters recorded');
  perform tests.ok((select outcome from board.motions where id = mo) = 'failed', 'a tie fails under majority of votes cast');
  perform tests.as_user(m1);
  perform tests.ok(tests.count(format('select * from board.member_votes where motion_id = %L', mo)) = 2, 'all votes visible once closed');
  perform tests.throws(format('select board.cast_vote(%L, %L)', mo, 'yes'), 'no votes after closing', 'closed');

  -- Without quorum nothing is calculated; a result needs an explanation.
  perform tests.as_user(owner);
  update board.org_settings set quorum_count = 10 where org_id = org;
  perform tests.as_user(chair);
  mo2 := board.start_vote(mtg, null, 'Move the meeting', 'Mia', 'Mo');
  perform board.close_vote(mo2);
  perform tests.ok((select outcome = 'pending' and vote_record ->> 'needs_disposition_reason' like 'Quorum%' from board.motions where id = mo2), 'no quorum: no calculated result');
  perform tests.throws(format('select board.record_disposition(%L, %L, %L)', mo2, 'carried', ''), 'an explanation is required', 'explanation');
  perform board.record_disposition(mo2, 'tabled', 'No quorum; tabled to next meeting');
  perform tests.ok((select outcome = 'tabled' and disposition_source = 'recorded' from board.motions where id = mo2), 'explained disposition recorded');

  -- Auto close when everyone has voted; a vote item's own rule overrides the default.
  perform tests.as_user(owner);
  update board.org_settings set quorum_count = 1, vote_close_modes = '{chair,auto}' where org_id = org;
  perform tests.as_user(chair);
  insert into board.agenda_items (org_id, meeting_id, title, is_vote_item, decision_rule) values (org, mtg, 'Bylaws', true, 'two_thirds_cast') returning id into item;
  mo3 := board.start_vote(mtg, item, 'Amend bylaws', 'Mia', 'Mo');
  perform board.cast_vote(mo3, 'yes');
  perform tests.as_user(m1); perform board.cast_vote(mo3, 'yes');
  perform tests.as_user(m2); perform board.cast_vote(mo3, 'no');
  perform tests.ok((select voting_status from board.motions where id = mo3) = 'open', 'stays open while Lee (present before it opened) hasn''t voted');
  perform tests.as_user(late); perform board.cast_vote(mo3, 'yes');
  perform tests.ok((select voting_status = 'closed' and vote_record ->> 'closed_how' = 'all_voted' from board.motions where id = mo3), 'closes when everyone has voted');
  perform tests.ok((select vote_record ->> 'decision_rule' = 'two_thirds_cast' and outcome = 'carried' from board.motions where id = mo3), 'two-thirds rule from the agenda item: 3 of 4 carries');

  -- Another organization can't vote, close or read the electorate.
  perform tests.as_user(outsider);
  perform tests.throws(format('select board.cast_vote(%L, %L)', mo3, 'yes'), 'outsiders cannot vote', 'not found');
  perform tests.throws(format('select board.close_vote(%L)', mo3), 'outsiders cannot close', 'not found');
  perform tests.ok(tests.count('select * from board.vote_electorate') = 0, 'outsiders cannot read the electorate');

  -- Read-only (plan lapsed): voting stops.
  perform tests.as_user(chair);
  update board.org_settings set vote_close_modes = '{chair}' where org_id = org;
  mo := board.start_vote(mtg, null, 'Last one', 'Mia', 'Mo');
  perform tests.lapse(org);
  perform tests.as_user(m1);
  perform tests.throws(format('select board.cast_vote(%L, %L)', mo, 'yes'), 'read-only: no votes', 'read-only');
  perform tests.as_user(chair);
  perform tests.throws(format('select board.start_vote(%L, null, %L, %L, %L)', mtg, 'Another', 'Mia', 'Mo'), 'read-only: no new votes', 'Not allowed');
  perform tests.throws(format('select board.close_vote(%L)', mo), 'read-only: cannot close', 'read-only');
  perform tests.as_user(m1);
  perform tests.throws(format('select board.finish_vote(%L, %L)', mo, 'chair'), 'finish_vote is internal', 'permission denied');
end
$$;
rollback;
