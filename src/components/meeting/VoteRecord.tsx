import { useState } from "react";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { errorMessage } from "@/lib/export";
import { CLOSED_HOW, DECISION_RULES, parseRollCall, parseVoteRecord, VOTE_LABEL, type DecisionRule } from "@/lib/votes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LiveMotion {
  id: string;
  voting_status: string;
  outcome: string;
  roll_call: unknown;
  vote_record: unknown;
  opened_at: string | null;
  closed_at: string | null;
  disposition_source: string | null;
  disposition_note: string | null;
  votes_yes: number;
  votes_no: number;
  votes_abstain: number;
  votes_recused?: number;
}

const when = (t: string | null) => (t ? new Date(t).toLocaleString() : "—");

/** The permanent facts captured for a live (member-cast) vote. */
export function VoteRecordView({ motion }: { motion: LiveMotion }) {
  const r = parseVoteRecord(motion.vote_record);
  if (!r) return null;
  const roll = parseRollCall(motion.roll_call);
  const closed = motion.voting_status === "closed";
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1 rounded-md border bg-background p-3 text-xs sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">Eligible voters</dt><dd>{r.electorate?.join(", ") || "—"} ({r.electorate?.length ?? 0})</dd>
      <dt className="text-muted-foreground">Quorum</dt><dd>{r.present_voting} voting members present · {r.quorum_required} required · {r.quorum_met ? "met" : "not met"}</dd>
      <dt className="text-muted-foreground">Decision rule</dt><dd>{DECISION_RULES[r.decision_rule as DecisionRule] ?? r.decision_rule}</dd>
      <dt className="text-muted-foreground">Opened</dt><dd>{when(motion.opened_at)}</dd>
      {closed && (
        <>
          <dt className="text-muted-foreground">Closed</dt><dd>{when(motion.closed_at)}{r.closed_how ? ` — ${CLOSED_HOW[r.closed_how]}` : ""}</dd>
          <dt className="text-muted-foreground">Votes</dt><dd>{motion.votes_yes} in favor · {motion.votes_no} opposed · {motion.votes_abstain} abstaining · {motion.votes_recused ?? 0} recused</dd>
          <dt className="text-muted-foreground">Recused</dt><dd>{r.recused?.join(", ") || "None"}</dd>
          <dt className="text-muted-foreground">How each voted</dt><dd>{roll.map((v) => `${v.person_name}: ${VOTE_LABEL[v.vote]}`).join("; ") || "—"}</dd>
          <dt className="text-muted-foreground">Did not vote</dt><dd>{r.not_voting?.join(", ") || "None"}</dd>
          <dt className="text-muted-foreground">Result</dt>
          <dd className="capitalize">
            {motion.outcome}
            {motion.disposition_source === "calculated" && " (calculated from the decision rule)"}
            {motion.disposition_source === "recorded" && ` (recorded by an authorized person: ${motion.disposition_note})`}
            {!motion.disposition_source && r.needs_disposition_reason && <span className="normal-case text-destructive"> — needs to be recorded: {r.needs_disposition_reason}</span>}
          </dd>
        </>
      )}
      {!!r.present_not_linked?.length && (<><dt className="text-muted-foreground">Present, not linked</dt><dd>{r.present_not_linked.join(", ")} (no account linked, so could not vote)</dd></>)}
    </dl>
  );
}

/** Lets a permitted role record the result when it couldn't be calculated, or mark it tabled/withdrawn. */
export function DispositionForm({ motion, onDone }: { motion: LiveMotion; onDone: () => void }) {
  const calculated = motion.disposition_source === "calculated";
  const options = calculated ? (["tabled", "withdrawn"] as const) : (["carried", "failed", "tabled", "withdrawn"] as const);
  const [outcome, setOutcome] = useState<(typeof options)[number]>(options[0]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(!calculated && motion.outcome === "pending");
  if (motion.voting_status !== "closed") return null;
  if (!open) return <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOpen(true)}>{calculated ? "Mark tabled or withdrawn" : "Change recorded result"}</Button>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await attempt(db.voting.recordDisposition(motion.id, outcome, note));
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Result recorded");
    setOpen(false);
    onDone();
  }
  return (
    <form onSubmit={save} className="mt-3 space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
      <p className="text-sm font-medium">Record the result</p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <div>
          <Label>Result</Label>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as (typeof options)[number])}>
            <SelectTrigger aria-label="Result"><SelectValue /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Explanation (required)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} placeholder="e.g. Bylaws Art. 5 require a majority of the full board" /></div>
      </div>
      <Button type="submit" size="sm">Save result</Button>
    </form>
  );
}
