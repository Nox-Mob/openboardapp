import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { attempt, db, EXPORT_TABLES } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { can, ROLES, ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { CLOSE_MODES, DECISION_RULES, type CloseMode } from "@/lib/votes";
import { downloadBlob, errorMessage, toCsv } from "@/lib/export";
import { PageHeader } from "@/components/PageStates";
import { BoardRecordExport } from "@/components/BoardRecordExport";
import { LetterheadSettings } from "@/components/LetterheadSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/board/settings")({
  head: () => ({ meta: [
    { title: "Settings & letterhead — OpenBoard" },
    { name: "description", content: "Manage organization settings, custom letterhead and board record exports." },
    { property: "og:title", content: "Settings & letterhead — OpenBoard" },
    { property: "og:description", content: "Manage organization settings, custom letterhead and board record exports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Settings,
});

const TABLES = EXPORT_TABLES;

function Settings() {
  const { org, refetch, setOrgId } = useCurrentOrg();
  const manager = can(org.role, "org.manage");
  const [f, setF] = useState({ name: org.name, timezone: org.timezone, quorum_count: org.quorum_count, vote_recording: org.vote_recording, vote_close_modes: org.vote_close_modes, vote_timer_minutes: org.vote_timer_minutes, vote_closer_roles: org.vote_closer_roles, seconder_required: org.seconder_required, decision_rule: org.decision_rule });
  const [newOrg, setNewOrg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.vote_close_modes.length) { toast.error("Choose at least one way for votes to close"); return; }
    if (f.vote_close_modes.includes("timer") && !f.vote_timer_minutes) { toast.error("Set the vote timer length"); return; }
    const { error } = await attempt(db.orgs.update(org.id, f));
    if (error) { toast.error(errorMessage(error)); return; }
    refetch();
    toast.success("Settings saved");
  }

  function fetchAll() {
    return db.orgs.exportAll(org.id);
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
      downloadBlob(new Blob([toCsv(data[table] ?? [])], { type: "text/csv" }), `${table}.csv`);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await attempt(db.orgs.create(newOrg, Intl.DateTimeFormat().resolvedOptions().timeZone));
    if (error !== null) { toast.error(errorMessage(error)); return; }
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
          <div>
            <Label htmlFor="vote-recording">How votes are recorded</Label>
            <select id="vote-recording" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.vote_recording} onChange={(e) => setF({ ...f, vote_recording: e.target.value })} disabled={!manager}>
              <option value="totals">Vote totals only (roll call optional per motion)</option>
              <option value="roll_call">Record how each board member voted</option>
            </select>
          </div>
          <div>
            <Label htmlFor="decision-rule">Decision rule for live votes</Label>
            <select id="decision-rule" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.decision_rule} onChange={(e) => setF({ ...f, decision_rule: e.target.value })} disabled={!manager}>
              {Object.entries(DECISION_RULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.seconder_required} onChange={(e) => setF({ ...f, seconder_required: e.target.checked })} disabled={!manager} />Motions require a seconder</label>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">How live votes close</legend>
            {(Object.keys(CLOSE_MODES) as CloseMode[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.vote_close_modes.includes(k)} disabled={!manager}
                  onChange={(e) => setF({ ...f, vote_close_modes: e.target.checked ? [...f.vote_close_modes, k] : f.vote_close_modes.filter((x) => x !== k) })} />
                {CLOSE_MODES[k]}
              </label>
            ))}
            {f.vote_close_modes.includes("timer") && (
              <div className="pl-6"><Label>Timer (minutes)</Label><Input type="number" min={1} max={240} value={f.vote_timer_minutes ?? ""} onChange={(e) => setF({ ...f, vote_timer_minutes: e.target.value ? Math.min(240, Math.max(1, Number(e.target.value))) : null })} disabled={!manager} className="w-28" /></div>
            )}
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Who can close a vote and record results</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ROLES.filter((r) => r !== "observer").map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.vote_closer_roles.includes(r)} disabled={!manager}
                    onChange={(e) => setF({ ...f, vote_closer_roles: e.target.checked ? [...f.vote_closer_roles, r] : f.vote_closer_roles.filter((x: OrgRole) => x !== r) })} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
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
              <BoardRecordExport orgId={org.id} orgName={org.name} />
            </>
          ) : <p className="text-sm text-muted-foreground">Only owners and administrators can export data.</p>}
        </section>
        <LetterheadSettings key={org.id} />
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
