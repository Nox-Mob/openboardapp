-- Security review round 3: Board's file storage takes documents and pictures only. Before, any
-- file type could be uploaded, including web pages (HTML), SVG pictures and scripts, which a
-- browser can run when the file is opened. The list matches what boards share: PDFs, office
-- documents, spreadsheets, slides, text, CSV and common pictures. The 25 MB limit stays.
do $$
begin
  -- Only where Supabase Storage keeps a list of allowed types (the tests' stub doesn't).
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    execute $q$
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf', 'text/rtf', 'text/plain', 'text/csv'
]
where id = 'board-files'
    $q$;
  end if;
end $$;
