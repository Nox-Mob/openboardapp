import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { useTemplates } from "@/lib/meeting-data";
import { agendaToText, parseAgendaText, STANDARD_AGENDA, totalMinutes } from "@/lib/templates";
import { PageHeader, LoadingState, EmptyState, ErrorState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/board/templates")({
  head: () => ({ meta: [{"title": "Meeting templates — OpenBoard"}, {"name": "description", "content": "Manage reusable agenda outlines for board meetings."}, {"property": "og:title", "content": "Meeting templates — OpenBoard"}, {"property": "og:description", "content": "Manage reusable agenda outlines for board meetings."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: Templates,
});

interface Form { id?: string; name: string; meeting_title: string; start_time: string; location: string; agenda: string }
const blank: Form = { name: "", meeting_title: "Regular Board Meeting", start_time: "18:30", location: "", agenda: agendaToText(STANDARD_AGENDA) };

function Templates() {
  const { org, userId } = useCurrentOrg();
  const qc = useQueryClient();
  const q = useTemplates(org.id);
  const editor = can(org.role, "records.edit");
  const [form, setForm] = useState<Form | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["templates", org.id] });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const agenda = parseAgendaText(form.agenda);
    if (!agenda.length) { toast.error("Add at least one agenda item"); return; }
    const { error } = await attempt(db.templates.save({
      ...(form.id ? { id: form.id } : {}),
      organization_id: org.id, created_by: userId, name: form.name, meeting_title: form.meeting_title,
      start_time: form.start_time || null, location: form.location || null, agenda,
    }));
    if (error !== null) { toast.error(errorMessage(error)); return; }
    setForm(null); refresh(); toast.success("Template saved");
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete the "${name}" template? Meetings already created from it are not affected.`)) return;
    const { error } = await attempt(db.templates.remove(id));
    if (error !== null) { toast.error(errorMessage(error)); return; }
    refresh();
  }

  return (
    <>
      <PageHeader eyebrow={org.name} title="Meeting templates" actions={editor && <Button onClick={() => setForm(blank)}>New template</Button>}>
        Reusable agendas for regular, annual or special meetings. Pick one when you schedule a meeting.
      </PageHeader>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} /> : !q.data?.length ? (
        <EmptyState title="No templates yet">Create one here, or open a meeting and choose “Save as template”.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((t) => (
            <section key={t.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">{t.meeting_title}{t.start_time ? ` · ${t.start_time}` : ""}{t.location ? ` · ${t.location}` : ""}</p>
                </div>
                {editor && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setForm({ id: t.id, name: t.name, meeting_title: t.meeting_title, start_time: t.start_time ?? "", location: t.location ?? "", agenda: agendaToText(t.agenda) })}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id, t.name)}>Delete</Button>
                  </div>
                )}
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {t.agenda.map((a, i) => <li key={i}>{a.title}{a.presenter ? <span className="text-muted-foreground"> — {a.presenter}</span> : null}{a.duration_minutes ? <span className="font-mono text-xs text-muted-foreground"> {a.duration_minutes} min</span> : null}</li>)}
              </ol>
              {totalMinutes(t.agenda) > 0 && <p className="mt-2 font-mono text-xs text-muted-foreground">About {totalMinutes(t.agenda)} minutes</p>}
            </section>
          ))}
        </div>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={save} className="space-y-3">
              <div><Label htmlFor="t-name">Template name</Label><Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Annual general meeting" required /></div>
              <div><Label htmlFor="t-title">Meeting title</Label><Input id="t-title" value={form.meeting_title} onChange={(e) => setForm({ ...form, meeting_title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="t-time">Start time</Label><Input id="t-time" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label htmlFor="t-loc">Location</Label><Input id="t-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <div>
                <Label htmlFor="t-agenda">Agenda</Label>
                <Textarea id="t-agenda" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} className="min-h-48 font-mono text-xs" />
                <p className="mt-1 text-xs text-muted-foreground">One item per line. Optional: <span className="font-mono">Title | Presenter | Minutes</span></p>
              </div>
              <Button type="submit" className="w-full">Save template</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
