import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/data";
import { useCurrentOrg, useOrgMembers } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { PageHeader, LoadingState, EmptyState, ErrorState } from "@/components/PageStates";

export const Route = createFileRoute("/_authenticated/board/audit")({
  component: Audit,
});

const ENTITY: Record<string, string> = {
  organizations: "Organization", memberships: "Membership", invitations: "Invitation", board_terms: "Board term",
  committees: "Committee", committee_members: "Committee member", meetings: "Meeting", agenda_items: "Agenda item",
  attendance: "Attendance", motions: "Motion", minutes: "Minutes", documents: "Document", document_versions: "Document version",
  packets: "Board packet", action_items: "Action item",
};

function Audit() {
  const { org } = useCurrentOrg();
  const members = useOrgMembers(org.id);
  const q = useQuery({
    enabled: can(org.role, "audit.read"),
    queryKey: ["audit", org.id],
    queryFn: () => db.audit.list(org.id),
  });
  const nameOf = (id: string | null) => members.data?.find((m) => m.user_id === id)?.name ?? (id ? "Former member" : "System");

  if (!can(org.role, "audit.read")) return <EmptyState title="Only officers can view the audit log" />;
  return (
    <>
      <PageHeader eyebrow={org.name} title="Audit log">Every change is recorded automatically. The log can't be edited.</PageHeader>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} /> : !q.data?.length ? <EmptyState title="No activity yet" /> : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left"><tr><th className="eyebrow px-4 py-2">When</th><th className="eyebrow px-4 py-2">Who</th><th className="eyebrow px-4 py-2">Action</th><th className="eyebrow px-4 py-2">Record</th></tr></thead>
            <tbody className="divide-y">
              {q.data.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{nameOf(a.actor_id)}</td>
                  <td className="px-4 py-2 capitalize">{a.action === "insert" ? "created" : a.action === "delete" ? "deleted" : "changed"} {ENTITY[a.entity] ?? a.entity}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">{a.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
