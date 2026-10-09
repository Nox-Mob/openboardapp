import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { downloadBlob, errorMessage, toCsv } from "@/lib/export";
import { PageHeader } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/board/settings")({
  component: Settings,
});

const TABLES = ["organizations", "memberships", "board_terms", "committees", "committee_members", "meetings", "agenda_items", "attendance", "motions", "minutes", "documents", "document_versions", "packets", "action_items", "audit_log"] as const;

function Settings() {
  const { org, refetch, setOrgId } = useCurrentOrg();
  const manager = can(org.role, "org.manage");
  const [f, setF] = useState({ name: org.name, timezone: org.timezone, quorum_count: org.quorum_count });
  const [newOrg, setNewOrg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("organizations").update(f).eq("id", org.id);
    if (error) return toast.error(errorMessage(error));
    refetch();
    toast.success("Settings saved");
  }

  async function fetchAll() {
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const t of TABLES) {
      const col = t === "organizations" ? "id" : "organization_id";
      const { data, error } = await supabase.from(t).select("*").eq(col, org.id);
      if (error) throw error;
      out[t] = (data ?? []) as Record<string, unknown>[];
    }
    return out;
  }

  async function exportJson() {
    setBusy(true);
    try {
      const data = await fetchAll();
      const manifest = { format: "openboard-export", version: 1, exported_at: new Date().toISOString(), organization_id: org.id, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
      downloadBlob(new Blob([JSON.stringify({ manifest, data }, null, 2)], { type: "application/json" }), `${org.name.replace(/\W+/g, "-")}-export.json`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }

  async function exportCsv(table: (typeof TABLES)[number]) {
    try {
      const data = await fetchAll();
      downloadBlob(new Blob([toCsv(data[table])], { type: "text/csv" }), `${table}.csv`);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("create_organization", { _name: newOrg, _timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (error) return toast.error(errorMessage(error));
    setOrgId(data as string);
    refetch();
    setNewOrg("");
    toast.success("Organization created");
  }

  return (
    <>
      <PageHeader eyebrow={org.name} title="Settings & export" />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="space-y-3 rounded-lg border bg-card p-5">
          <p className="eyebrow">Organization</p>
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!manager} required /></div>
          <div><Label>Time zone</Label><Input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} disabled={!manager} /></div>
          <div><Label>Quorum (members required)</Label><Input type="number" min={1} value={f.quorum_count} onChange={(e) => setF({ ...f, quorum_count: Math.max(1, Number(e.target.value)) })} disabled={!manager} /></div>
          {manager && <Button type="submit">Save</Button>}
        </form>
        <section className="space-y-3 rounded-lg border bg-card p-5">
          <p className="eyebrow">Data export</p>
          {can(org.role, "export.run") ? (
            <>
              <p className="text-sm text-muted-foreground">A complete JSON export of your organization's records, with a manifest of record counts so you can verify it. Uploaded files stay in the document library.</p>
              <Button onClick={exportJson} disabled={busy}>{busy ? "Preparing…" : "Download full export (JSON)"}</Button>
              <div className="flex flex-wrap gap-2 pt-2">
                {(["meetings", "motions", "minutes", "action_items", "board_terms", "audit_log"] as const).map((t) => (
                  <Button key={t} size="sm" variant="outline" onClick={() => exportCsv(t)}>{t.replace("_", " ")} CSV</Button>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Only owners and administrators can export data.</p>}
        </section>
        <form onSubmit={createOrg} className="space-y-3 rounded-lg border bg-card p-5">
          <p className="eyebrow">Another organization</p>
          <p className="text-sm text-muted-foreground">Serve on more than one board? Create another organization and switch between them in the sidebar.</p>
          <Input placeholder="Organization name" value={newOrg} onChange={(e) => setNewOrg(e.target.value)} required />
          <Button type="submit" variant="secondary">Create organization</Button>
        </form>
      </div>
    </>
  );
}
