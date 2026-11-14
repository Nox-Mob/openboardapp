-- Pre-production tuning (core 0016): nothing left to tune in the board schema.
begin;
do $$
declare n int;
begin
  select count(*) into n from public.tuning_problems('board');
  if n > 0 then
    raise exception 'FAILED: % has % things to tune: %', 'board', n,
      (select string_agg(kind || ' (' || object || ')', '; ') from public.tuning_problems('board'));
  end if;
end $$;
rollback;
