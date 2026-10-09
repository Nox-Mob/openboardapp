import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { attempt, db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { errorMessage } from "@/lib/export";
import { useAgenda } from "@/lib/meeting-data";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Saves this meeting's title, time, place and agenda outline as a reusable template (notes are not copied). */
export function SaveAsTemplate({ meeting }: { meeting: Tables<"meetings"> }) {
  const { org, userId } = useCurrentOrg();
  const agenda = useAgenda(meeting.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(meeting.title);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await attempt(db.templates.save({
      organization_id: org.id,
      created_by: userId,
      name,
      meeting_title: meeting.title,
      start_time: meeting.start_time,
      location: meeting.location,
      agenda: (agenda.data ?? []).map((a) => ({ title: a.title, presenter: a.presenter, duration_minutes: a.duration_minutes, description: a.description })),
    }));
    if (error !== null) { toast.error(errorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["templates", org.id] });
    setOpen(false);
    toast.success("Template saved");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Save as template</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Save as meeting template</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label htmlFor="tpl-name">Template name</Label><Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <p className="text-xs text-muted-foreground">Copies the title, start time, location and {agenda.data?.length ?? 0} agenda items. Notes and votes are not copied.</p>
          <Button type="submit" className="w-full">Save template</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
