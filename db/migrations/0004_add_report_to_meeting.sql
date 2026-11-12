-- Reports into a board package (S-13, SHARED-SPEC §3.6): the way another app (or Board itself)
-- adds a report to an upcoming meeting. It records a Board document of that meeting (category
-- 'Report') with version 1 and returns where the PDF goes; the caller then uploads the PDF to that
-- path in the `board-files` bucket. In the meeting's Packet tab the report is listed with the
-- meeting's other documents, ready to go into the packet.
-- `security invoker`: Board's own row security applies, so only people who can edit Board's
-- records (owner, admin, chair, secretary) can add a report, and only while Board is writable.
create function board.add_report_to_meeting(
  p_meeting uuid,
  p_title text,
  p_file_name text,
  p_source_app text default 'board'
) returns table (document_id uuid, storage_path text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meeting board.meetings;
  v_doc uuid;
  v_path text;
  v_source text := case p_source_app
    when 'charter' then 'OpenCharterApp'
    when 'ledger' then 'OpenLedgerApp'
    else 'OpenBoardApp' end;
begin
  select * into v_meeting from board.meetings m where m.id = p_meeting;
  if v_meeting.id is null then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;
  if v_meeting.status not in ('draft', 'scheduled', 'in_progress') then
    raise exception 'Reports can be added only to meetings that haven''t happened yet' using errcode = '22023';
  end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_file_name), '') is null then
    raise exception 'A title and a file name are required' using errcode = '22023';
  end if;
  insert into board.documents (org_id, meeting_id, title, category)
  values (v_meeting.org_id, v_meeting.id, btrim(p_title), 'Report from ' || v_source)
  returning id into v_doc;
  v_path := v_meeting.org_id || '/documents/' || v_doc || '/v1-' ||
    regexp_replace(btrim(p_file_name), '[^A-Za-z0-9_.-]+', '_', 'g');
  insert into board.document_versions (org_id, document_id, version, storage_path, file_name, mime_type)
  values (v_meeting.org_id, v_doc, 1, v_path, btrim(p_file_name), 'application/pdf');
  return query select v_doc, v_path;
end;
$$;

comment on function board.add_report_to_meeting(uuid, text, text, text) is
  'Adds a report (PDF) to an upcoming meeting''s documents. docs/INTEGRATION.md';
revoke all on function board.add_report_to_meeting(uuid, text, text, text) from public, anon;
grant execute on function board.add_report_to_meeting(uuid, text, text, text) to authenticated;
