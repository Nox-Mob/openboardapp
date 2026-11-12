-- H-04: people across the apps. The hub's Members page shows each person's role in every app;
-- OpenBoardApp's role is the core role plus an office (owner, admin, chair, secretary, treasurer,
-- board member, observer). Read-only, with the caller's own row security. Add columns at the end.
create or replace view board.api_people with (security_invoker = true) as
select o.org_id, o.user_id, o.office::text as office
from board.officers o;
comment on view board.api_people is 'Board offices per person (H-04). docs/INTEGRATION.md';
grant select on board.api_people to authenticated;
