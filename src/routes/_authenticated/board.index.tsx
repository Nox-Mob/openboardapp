import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/PageStates";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/board/")({
  head: () => ({ meta: [{"title": "Board overview — OpenBoard"}, {"name": "description", "content": "Review upcoming meetings, minutes and assigned actions."}, {"property": "og:title", "content": "Board overview — OpenBoard"}, {"property": "og:description", "content": "Review upcoming meetings, minutes and assigned actions."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: Overview,
});

function Overview() {
  const { org, userId } = useCurrentOrg();
  const today = new Date().toLocaleDateString("en-CA");
  const q = useQuery({
    queryKey: ["overview", org.id],
    queryFn: () => db.overview.load(org.id, userId, today),
  });

  return (
    <>
      <PageHeader eyebrow={org.name} title="Overview" />
      {q.isLoading || !q.data ? <LoadingState /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-lg border bg-card p-5 lg:col-span-2">
            <p className="eyebrow">Upcoming meetings</p>
            {q.data.meetings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No upcoming meetings. <Link to="/board/meetings" className="text-primary underline">Schedule one</Link>.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {q.data.meetings.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <Link to="/board/meetings/$meetingId" params={{ meetingId: m.id }} className="font-medium hover:text-primary">{m.title}</Link>
                    {m.status === "in_progress" ? (
                      <Link to="/board/live/$meetingId" params={{ meetingId: m.id }} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Join meeting</Link>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{m.meeting_date} {m.start_time ?? ""}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border bg-card p-5">
            <p className="eyebrow">Minutes awaiting approval</p>
            {q.data.minutes.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nothing waiting.</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {q.data.minutes.map((m) => (
                  <li key={m.id}>
                    <Link to="/board/meetings/$meetingId" params={{ meetingId: m.meeting_id }} search={{ tab: "minutes" }} className="hover:text-primary">
                      {(m.meetings as { title: string } | null)?.title} <span className="text-muted-foreground">v{m.version}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border bg-card p-5 lg:col-span-3">
            <p className="eyebrow">My action items</p>
            {q.data.tasks.length === 0 ? <div className="mt-3"><EmptyState title="You're all caught up" /></div> : (
              <ul className="mt-3 divide-y">
                {q.data.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                    <span>{t.title}</span>
                    <span className="flex items-center gap-2">
                      {t.due_date && t.due_date < today && <Badge variant="destructive">Overdue</Badge>}
                      <span className="font-mono text-xs text-muted-foreground">{t.due_date ?? "No due date"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
