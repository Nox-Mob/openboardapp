import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org-context";
import { errorMessage } from "@/lib/export";
import { formatMotion } from "@/lib/minutes";
import { useAgenda, useMotions, useInvalidateMeeting } from "@/lib/meeting-data";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OUTCOMES = ["carried", "failed", "tabled", "withdrawn", "pending"] as const;
const empty = { agenda_item_id: "none", motion_text: "", moved_by: "", seconded_by: "", votes_yes: 0, votes_no: 0, votes_abstain: 0, outcome: "carried" as (typeof OUTCOMES)[number] };

export function MotionsTab({ meetingId, editable }: { meetingId: string; editable: boolean }) {
  const { org } = useCurrentOrg();
  const agenda = useAgenda(meetingId);
  const motions = useMotions(meetingId);
  const invalidate = useInvalidateMeeting(meetingId);
  const [f, setF] = useState(empty);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("motions").insert({
      ...f,
      agenda_item_id: f.agenda_item_id === "none" ? null : f.agenda_item_id,
      moved_by: f.moved_by || null,
      seconded_by: f.seconded_by || null,
      meeting_id: meetingId,
      organization_id: org.id,
    });
    if (error) { toast.error(errorMessage(error)); return; }
    setF(empty);
    invalidate("motions");
    toast.success("Motion recorded");
  }

  async function remove(id: string) {
    if (!confirm("Delete this motion?")) return;
    const { error } = await supabase.from("motions").delete().eq("id", id);
    if (error) { toast.error(errorMessage(error)); return; }
    invalidate("motions");
  }

  if (motions.isLoading) return <LoadingState />;
  const titleOf = (id: string | null) => agenda.data?.find((a) => a.id === id)?.title;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-3">
        {!motions.data?.length ? <EmptyState title="No motions recorded" /> : motions.data.map((m) => (
          <div key={m.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="eyebrow">{titleOf(m.agenda_item_id) ?? "General"}</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.outcome} />
                {editable && <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
            <p className="mt-2 font-display text-sm leading-relaxed">{formatMotion(m)}</p>
          </div>
        ))}
      </div>
      {editable && (
        <form onSubmit={save} className="space-y-3 rounded-lg border bg-card p-5 lg:col-span-2">
          <p className="eyebrow">Record a motion</p>
          <div>
            <Label>Agenda item</Label>
            <Select value={f.agenda_item_id} onValueChange={(v) => setF({ ...f, agenda_item_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General / not tied to an item</SelectItem>
                {agenda.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Motion</Label><Textarea value={f.motion_text} onChange={(e) => setF({ ...f, motion_text: e.target.value })} placeholder="To approve the 2027 operating budget as presented" required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Moved by</Label><Input value={f.moved_by} onChange={(e) => setF({ ...f, moved_by: e.target.value })} /></div>
            <div><Label>Seconded by</Label><Input value={f.seconded_by} onChange={(e) => setF({ ...f, seconded_by: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["votes_yes", "votes_no", "votes_abstain"] as const).map((k) => (
              <div key={k}><Label>{k === "votes_yes" ? "In favor" : k === "votes_no" ? "Opposed" : "Abstain"}</Label><Input type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value)) })} /></div>
            ))}
          </div>
          <div>
            <Label>Outcome</Label>
            <Select value={f.outcome} onValueChange={(v) => setF({ ...f, outcome: v as (typeof OUTCOMES)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">Save motion</Button>
        </form>
      )}
    </div>
  );
}
