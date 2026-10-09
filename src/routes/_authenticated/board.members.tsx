import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg, useOrgMembers } from "@/lib/org-context";
import { can, ROLES, ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { PageHeader, LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/board/members")({
  component: Members,
});

const INVITABLE = ROLES.filter((r) => r !== "owner");

function Members() {
  const { org, userId } = useCurrentOrg();
  const qc = useQueryClient();
  const members = useOrgMembers(org.id);
  const manager = can(org.role, "org.manage");
  const editor = can(org.role, "records.edit");
  const [inv, setInv] = useState({ email: "", role: "member" as OrgRole });
  const [link, setLink] = useState<string | null>(null);
  const [term, setTerm] = useState({ person_name: "", position: "Director", start_date: "", end_date: "" });
  const today = new Date().toLocaleDateString("en-CA");

  const invites = useQuery({
    enabled: manager,
    queryKey: ["invites", org.id],
    queryFn: async () => (await supabase.from("invitations").select("*").eq("organization_id", org.id).is("accepted_at", null).order("created_at", { ascending: false })).data ?? [],
  });
  const terms = useQuery({
    queryKey: ["terms", org.id],
    queryFn: async () => (await supabase.from("board_terms").select("*").eq("organization_id", org.id).order("start_date", { ascending: false })).data ?? [],
  });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("create_invitation", { _org: org.id, _email: inv.email, _role: inv.role });
    if (error) { toast.error(errorMessage(error)); return; }
    setLink(`${window.location.origin}/invite/${data}`);
    setInv({ email: "", role: "member" });
    qc.invalidateQueries({ queryKey: ["invites", org.id] });
  }

  async function changeRole(id: string, role: OrgRole) {
    const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
    if (error) { toast.error(errorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["org-members", org.id] });
  }
  async function removeMember(id: string) {
    if (!confirm("Remove this person from the organization?")) return;
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) { toast.error(errorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["org-members", org.id] });
  }
  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("board_terms").insert({ ...term, end_date: term.end_date || null, organization_id: org.id });
    if (error) { toast.error(errorMessage(error)); return; }
    setTerm({ person_name: "", position: "Director", start_date: "", end_date: "" });
    qc.invalidateQueries({ queryKey: ["terms", org.id] });
  }
  async function deleteTerm(id: string) {
    const { error } = await supabase.from("board_terms").delete().eq("id", id);
    if (error) { toast.error(errorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["terms", org.id] });
  }
  async function revoke(id: string) {
    await supabase.from("invitations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["invites", org.id] });
  }

  const current = (terms.data ?? []).filter((t) => !t.end_date || t.end_date >= today);
  const former = (terms.data ?? []).filter((t) => t.end_date && t.end_date < today);

  return (
    <>
      <PageHeader eyebrow={org.name} title="Members & terms" />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <p className="eyebrow mb-2">App access</p>
          {members.isLoading ? <LoadingState /> : (
            <div className="divide-y rounded-lg border bg-card">
              {members.data?.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div><p className="font-medium">{m.name}{m.user_id === userId && <span className="text-muted-foreground"> (you)</span>}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                  <div className="flex items-center gap-2">
                    {manager && m.role !== "owner" ? (
                      <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as OrgRole)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{INVITABLE.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>}
                    {manager && m.role !== "owner" && m.user_id !== userId && <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {manager && (
          <section className="space-y-3">
            <form onSubmit={invite} className="space-y-3 rounded-lg border bg-card p-5">
              <p className="eyebrow">Invite someone</p>
              <div><Label>Email (for your records)</Label><Input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></div>
              <div><Label>Role</Label>
                <Select value={inv.role} onValueChange={(v) => setInv({ ...inv, role: v as OrgRole })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INVITABLE.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select>
              </div>
              <Button type="submit" className="w-full">Create invite link</Button>
              {link && (
                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="mb-1 font-medium">Send this link (valid 14 days, single use):</p>
                  <div className="flex items-center gap-2"><code className="flex-1 break-all">{link}</code><Button type="button" size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button></div>
                </div>
              )}
            </form>
            {!!invites.data?.length && (
              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="eyebrow mb-2">Pending invites</p>
                {invites.data.map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-1">
                    <span>{i.email || "Link"} · {ROLE_LABELS[i.role as OrgRole]}</span>
                    <button className="text-xs text-destructive" onClick={() => revoke(i.id)}>Revoke</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <section className="mt-10">
        <p className="eyebrow mb-2">Board composition & terms of service</p>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {[{ label: "Current", rows: current }, { label: "Former", rows: former }].map((g) => (
              <div key={g.label}>
                <h3 className="mb-2 text-base">{g.label}</h3>
                {!g.rows.length ? <EmptyState title={`No ${g.label.toLowerCase()} board terms`} /> : (
                  <div className="divide-y rounded-lg border bg-card">
                    {g.rows.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div><p className="font-medium">{t.person_name}</p><p className="text-xs text-muted-foreground">{t.position}</p></div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{t.start_date} → {t.end_date ?? "present"}</span>
                          {editor && <Button size="icon" variant="ghost" onClick={() => deleteTerm(t.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {editor && (
            <form onSubmit={addTerm} className="h-fit space-y-3 rounded-lg border bg-card p-5">
              <p className="eyebrow">Record a term</p>
              <div><Label>Name</Label><Input value={term.person_name} onChange={(e) => setTerm({ ...term, person_name: e.target.value })} required /></div>
              <div><Label>Position</Label><Input value={term.position} onChange={(e) => setTerm({ ...term, position: e.target.value })} placeholder="President, Treasurer, Director…" required /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Start</Label><Input type="date" value={term.start_date} onChange={(e) => setTerm({ ...term, start_date: e.target.value })} required /></div>
                <div><Label>End</Label><Input type="date" value={term.end_date} onChange={(e) => setTerm({ ...term, end_date: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">Add term</Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
