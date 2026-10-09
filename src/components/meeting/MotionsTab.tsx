import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { attempt, db } from "@/data";
import { useCurrentOrg, useTitles } from "@/lib/org-context";
import { errorMessage } from "@/lib/export";
import { formatMotion } from "@/lib/minutes";
import { useAgenda, useAttendance, useMotions, useInvalidateMeeting } from "@/lib/meeting-data";
import { presentAttendees, rollCallVoters, tally, type Vote } from "@/lib/votes";
import { Checkbox } from "@/components/ui/checkbox";
import { DispositionForm, VoteRecordView } from "@/components/meeting/VoteRecord";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OUTCOMES = ["carried", "failed", "tabled", "withdrawn", "pending"] as const;
const empty = { agenda_item_id: "none", motion_text: "", moved_by: "none", seconded_by: "none", votes_yes: 0, votes_no: 0, votes_abstain: 0, outcome: "carried" as (typeof OUTCOMES)[number] };

export function MotionsTab({ meetingId, editable }: { meetingId: string; editable: boolean }) {
  const { org } = useCurrentOrg();
  const titles = useTitles(org.id);
  const agenda = useAgenda(meetingId);
  const motions = useMotions(meetingId);
  const invalidate = useInvalidateMeeting(meetingId);
  const attendance = useAttendance(meetingId);
  const [f, setF] = useState(empty);
  const required = org.vote_recording === "roll_call";
  const [rollOptIn, setRollOptIn] = useState(false);
  const useRoll = required || rollOptIn;
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const present = presentAttendees(attendance.data ?? []);
  const voters = rollCallVoters(attendance.data ?? []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const roll = useRoll ? voters.filter((v) => votes[v.id]).map((v) => ({ attendance_id: v.id, person_name: v.person_name, vote: votes[v.id]! })) : null;
    if (useRoll && roll!.length < voters.length) { toast.error("Record a vote for every voting member present"); return; }
    if (f.moved_by !== "none" && f.moved_by === f.seconded_by) { toast.error("The same person can't move and second"); return; }
    const counts = roll ? tally(roll) : { votes_yes: f.votes_yes, votes_no: f.votes_no, votes_abstain: f.votes_abstain };
    const { error } = await attempt(db.motions.add({
      ...f,
      ...counts,
      roll_call: roll,
      agenda_item_id: f.agenda_item_id === "none" ? null : f.agenda_item_id,
      moved_by: f.moved_by === "none" ? null : f.moved_by,
      seconded_by: f.seconded_by === "none" ? null : f.seconded_by,
      meeting_id: meetingId,
      organization_id: org.id,
    }));
    if (error) { toast.error(errorMessage(error)); return; }
    setF(empty);
    setVotes({});
    setRollOptIn(false);
    invalidate("motions");
    toast.success("Motion recorded");
  }

  async function remove(id: string) {
    if (!confirm("Delete this motion?")) return;
    const { error } = await attempt(db.motions.remove(id));
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
                {editable && m.voting_status === "manual" && <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
            <p className="mt-2 font-display text-sm leading-relaxed">{formatMotion(m)}</p>
            {m.voting_status !== "manual" && <VoteRecordView motion={m} />}
            {editable && m.voting_status === "closed" && org.vote_closer_roles.includes(org.role) && <DispositionForm motion={m} onDone={() => invalidate("motions")} />}
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
            {(["moved_by", "seconded_by"] as const).map((k) => (
              <div key={k}>
                <Label>{k === "moved_by" ? "Moved by" : "Seconded by"}</Label>
                <Select value={f[k]} onValueChange={(v) => setF({ ...f, [k]: v })}>
                  <SelectTrigger aria-label={k === "moved_by" ? "Moved by" : "Seconded by"}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not recorded</SelectItem>
                    {present.map((a) => <SelectItem key={a.id} value={a.person_name}>{titles.label(a.person_name, a.user_id)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {!present.length && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Mark people present on the Attendance tab to pick who moved and seconded.</span>
            </p>
          )}
          {required ? (
            <p className="text-xs text-muted-foreground">Your organization records how each board member votes.</p>
          ) : (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={rollOptIn} onCheckedChange={(c) => setRollOptIn(c === true)} />Record how each member voted on this motion</label>
          )}
          {useRoll ? (
            <div className="space-y-2 rounded-md border p-3">
              {!voters.length && <p className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />No voting members are marked present.</p>}
              {voters.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{titles.label(v.person_name, v.user_id)}</span>
                  <div className="flex gap-1" role="group" aria-label={`${v.person_name} vote`}>
                    {(["yes", "no", "abstain"] as const).map((o) => (
                      <Button key={o} type="button" size="sm" variant={votes[v.id] === o ? "default" : "outline"} onClick={() => setVotes({ ...votes, [v.id]: o })}>
                        {o === "yes" ? "Yes" : o === "no" ? "No" : "Abstain"}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {voters.length > 0 && (() => { const t = tally(voters.filter((v) => votes[v.id]).map((v) => ({ attendance_id: v.id, person_name: v.person_name, vote: votes[v.id]! }))); return <p className="font-mono text-xs text-muted-foreground">{t.votes_yes} in favor · {t.votes_no} opposed · {t.votes_abstain} abstaining</p>; })()}
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-2">
            {(["votes_yes", "votes_no", "votes_abstain"] as const).map((k) => (
              <div key={k}><Label>{k === "votes_yes" ? "In favor" : k === "votes_no" ? "Opposed" : "Abstain"}</Label><Input type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value)) })} /></div>
            ))}
          </div>
          )}
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
