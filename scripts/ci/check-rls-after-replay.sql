-- Post-replay check (run with psql against the rebuilt database, e.g. by
-- .github/workflows/supabase-db.yml after `supabase db reset`).
-- Every table in schema public must have row level security enabled and at least
-- one data privilege (SELECT/INSERT/UPDATE/DELETE) granted to authenticated or service_role. It inspects the
-- live catalog, so tables secured inside `foreach ... execute format(...)` loops
-- are checked exactly as they ended up. Fails (ON_ERROR_STOP) naming each table.
\set ON_ERROR_STOP on
do $$
declare
  r record;
  problems text[] := '{}';
  checked int := 0;
begin
  for r in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p')
    order by c.relname
  loop
    checked := checked + 1;
    if not r.relrowsecurity then
      problems := problems || format('%s: row level security is not enabled', r.relname);
    end if;
    if not exists (
      select 1
      from aclexplode(coalesce((select relacl from pg_class where oid = r.oid), acldefault('r', (select relowner from pg_class where oid = r.oid)))) a
      where a.grantee in ('authenticated'::regrole, 'service_role'::regrole)
        and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) then
      problems := problems || format('%s: no SELECT/INSERT/UPDATE/DELETE GRANT to authenticated or service_role', r.relname);
    end if;
  end loop;
  if checked = 0 then
    raise exception 'No tables found in schema public: did the migrations run?';
  end if;
  if cardinality(problems) > 0 then
    raise exception E'RLS/GRANT check failed for % table(s):\n%', cardinality(problems), array_to_string(problems, E'\n');
  end if;
  raise notice 'RLS/GRANT check passed for % public tables.', checked;
end $$;
