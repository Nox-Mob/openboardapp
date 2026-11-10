#!/usr/bin/env bash
# Database rules (mirrors OpenCharterApp's scripts/db-test.sh): builds a throwaway
# database the way production is built, with the vendored migration runner (core,
# then db/migrations), on plain Postgres with a stub of the Supabase-managed
# schemas, then runs db/tests/*.sql. Each test file runs in a transaction that is
# rolled back.
#
# Requires TEST_DATABASE_URL pointing at a server where the user may create databases.
# Never point this at a real project database.
set -euo pipefail
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL, e.g. postgres://postgres:postgres@localhost:5432/postgres}"
DB="${TEST_DB_NAME:-board_rules_test}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
URL="${TEST_DATABASE_URL%/*}/$DB"
admin() { psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -X "$@"; }
run() { psql "$URL" -v ON_ERROR_STOP=1 -q -X "$@"; }

admin -c "drop database if exists $DB" -c "create database $DB"
run -f "$ROOT/db/ci/supabase-stub.sql"
(cd "$ROOT" && DATABASE_URL="$URL" node scripts/migrate.mjs)
# Running the runner again must change nothing (every file is recorded).
(cd "$ROOT" && DATABASE_URL="$URL" node scripts/migrate.mjs | grep -q "Nothing to apply") \
  || { echo "FAIL a second migrate run wanted to apply something"; exit 1; }
run -f "$ROOT/db/tests/00_helpers.sql"

fail=0
for f in $(ls "$ROOT"/db/tests/[0-9]*.sql | sort); do
  [ "$(basename "$f")" = "00_helpers.sql" ] && continue
  if out=$(run -f "$f" 2>&1); then echo "ok   $(basename "$f")"; else echo "FAIL $(basename "$f")"; echo "$out" | sed 's/^/     /'; fail=1; fi
done
[ -n "${KEEP_DB:-}" ] || admin -c "drop database if exists $DB"
exit $fail
