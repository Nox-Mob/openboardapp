# OpenBoardApp integration

What Board publishes for OpenAppHub and the other apps (SHARED-SPEC §3.6). Everything here is a
**read-only view** in schema `board`, created `with (security_invoker = true)`: it runs with the
caller's own row security, so a person sees exactly the rows they could read in Board itself
(members of the organization; nobody else; signed-out visitors nothing).

Rules for consumers:

- **Feature-detect.** On a database without Board (or before migration `0002`), the views don't
  exist. Treat "relation does not exist" (PostgREST `42P01` / `PGRST205`) as "Board isn't here" and
  hide the integration.
- **Never write.** Board exposes no write paths to other apps yet. A change in Board would go
  through a `security invoker` RPC documented here.
- **Columns are stable.** New columns are added at the end; none is removed or renamed.

Migration: [`db/migrations/0002_integration_views.sql`](../db/migrations/0002_integration_views.sql).
Tests: [`db/tests/60_integration_views.sql`](../db/tests/60_integration_views.sql).

## `board.api_meetings`

Meetings on the calendar: every status except `draft`.

| Column           | Type        | Meaning                                                                                              |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `id`             | uuid        | The meeting                                                                                          |
| `org_id`         | uuid        | The OpenAppHub organization                                                                          |
| `title`          | text        |                                                                                                      |
| `meeting_date`   | date        |                                                                                                      |
| `start_time`     | text        | As entered, for example `18:30`; may be null                                                         |
| `location`       | text        | May be null                                                                                          |
| `status`         | text        | `scheduled`, `in_progress`, `completed` or `archived`                                                |
| `minutes_status` | text        | Status of the latest minutes version: `draft`, `submitted`, `approved` or `superseded`; null if none |
| `motion_count`   | int         | Motions recorded at the meeting                                                                      |
| `created_at`     | timestamptz |                                                                                                      |

Example (the hub's dashboard: the next meeting):

```sql
select title, meeting_date from board.api_meetings
where org_id = :org and status = 'scheduled' and meeting_date >= current_date
order by meeting_date limit 1;
```

## `board.api_decisions`

Decisions: motions with an outcome (`pending` motions are left out).

| Column                                                    | Type        | Meaning                                          |
| --------------------------------------------------------- | ----------- | ------------------------------------------------ |
| `id`                                                      | uuid        | The motion                                       |
| `org_id`                                                  | uuid        | The OpenAppHub organization                      |
| `meeting_id`                                              | uuid        | Meeting it was made at                           |
| `meeting_title`                                           | text        |                                                  |
| `meeting_date`                                            | date        |                                                  |
| `motion_text`                                             | text        |                                                  |
| `outcome`                                                 | text        | `carried`, `failed`, `tabled` or `withdrawn`     |
| `votes_yes`, `votes_no`, `votes_abstain`, `votes_recused` | int         | The vote count                                   |
| `decided_at`                                              | timestamptz | When the vote closed or the outcome was recorded |

Example (recent decisions):

```sql
select motion_text, outcome, meeting_date from board.api_decisions
where org_id = :org order by decided_at desc limit 5;
```
