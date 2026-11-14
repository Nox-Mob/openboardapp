-- Pre-production tuning (2026-11-14): this app's schema through core 0016's helper. Policies call
-- auth.uid() once per query instead of once per row, and every foreign key gets an index.
-- Runs after the last migration that changes policies; db/tests/99_tuning.sql keeps it that way.
select public._tune_schema('board');

-- Documents and packets: at most 50 MB a file (Supabase's default upload limit; nothing larger
-- belongs in a board packet). Charter's branding bucket already has its own limit.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    execute $q$update storage.buckets set file_size_limit = 52428800 where id = 'board-files' and file_size_limit is null$q$;
  end if;
end $$;
