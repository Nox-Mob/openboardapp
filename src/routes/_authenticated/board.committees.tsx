import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { attempt, db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { PageHeader, LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/board/committees")({
  component: Committees,
});

function Committees() {
  const { org } = useCurrentOrg();
  const qc = useQueryClient();
  const editor = can(org.role, "records.edit");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const q = useQuery({
    queryKey: ["committees", org.id],
    queryFn: () => db.committees.list(org.id),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["committees", org.id] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await attempt(db.committees.add({ name, description: desc || null, organization_id: org.id }));
    if (error) { toast.error(errorMessage(error)); return; }
    setName(""); setDesc(""); refresh();
  }
  async function addMember(committeeId: string, person_name: string, role: string) {
    const { error } = await attempt(db.committees.addMember({ committee_id: committeeId, person_name, role: role || "Member", organization_id: org.id }));
    if (error) { toast.error(errorMessage(error)); return; }
    refresh();
  }
  async function del(table: "committees" | "committee_members", id: string) {
    const { error } = await attempt(db.committees.remove(table, id));
    if (error) { toast.error(errorMessage(error)); return; }
    refresh();
  }

  return (
    <>
      <PageHeader eyebrow={org.name} title="Committees" />
      {editor && (
        <form onSubmit={add} className="mb-6 flex flex-wrap gap-2 rounded-lg border bg-card p-4">
          <Input placeholder="Committee name" value={name} onChange={(e) => setName(e.target.value)} required className="w-60" />
          <Input placeholder="Purpose (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="flex-1" />
          <Button type="submit">Add committee</Button>
        </form>
      )}
      {q.isLoading ? <LoadingState /> : !q.data?.length ? <EmptyState title="No committees yet" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between">
                <div><h3 className="text-lg">{c.name}</h3>{c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}</div>
                {editor && <Button size="icon" variant="ghost" onClick={() => del("committees", c.id)} aria-label="Delete committee"><Trash2 className="h-4 w-4" /></Button>}
              </div>
              <ul className="mt-3 divide-y text-sm">
                {c.committee_members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span>{m.person_name} <span className="text-muted-foreground">· {m.role}</span></span>
                    {editor && <button onClick={() => del("committee_members", m.id)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>}
                  </li>
                ))}
              </ul>
              {editor && <AddMember onAdd={(n, r) => addMember(c.id, n, r)} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AddMember({ onAdd }: { onAdd: (name: string, role: string) => void }) {
  const [n, setN] = useState("");
  const [r, setR] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(n, r); setN(""); setR(""); }} className="mt-3 flex gap-2">
      <Input placeholder="Name" value={n} onChange={(e) => setN(e.target.value)} required />
      <Input placeholder="Role (Chair…)" value={r} onChange={(e) => setR(e.target.value)} className="w-36" />
      <Button type="submit" size="sm" variant="secondary">Add</Button>
    </form>
  );
}
