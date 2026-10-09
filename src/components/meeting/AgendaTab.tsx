import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { attempt, db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { errorMessage } from "@/lib/export";
import { useAgenda, useInvalidateMeeting } from "@/lib/meeting-data";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DECISION_RULES, type DecisionRule } from "@/lib/votes";

const DEFAULT = "org-default";
/** Rule picker: the organization default first, then every alternative. */
function RuleSelect({ value, orgRule, onChange, id }: { value: string | null; orgRule: string; onChange: (v: string | null) => void; id: string }) {
  return (
    <select id={id} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={value ?? DEFAULT} onChange={(e) => onChange(e.target.value === DEFAULT ? null : e.target.value)}>
      <option value={DEFAULT}>Organization default — {DECISION_RULES[orgRule as DecisionRule] ?? orgRule}</option>
      {(Object.keys(DECISION_RULES) as DecisionRule[]).filter((k) => k !== orgRule).map((k) => <option key={k} value={k}>{DECISION_RULES[k]}</option>)}
    </select>
  );
}

type Item = NonNullable<ReturnType<typeof useAgenda>["data"]>[number];

export function AgendaTab({ meetingId, editable }: { meetingId: string; editable: boolean }) {
  const { org } = useCurrentOrg();
  const agenda = useAgenda(meetingId);
  const invalidate = useInvalidateMeeting(meetingId);
  const [title, setTitle] = useState("");
  const [presenter, setPresenter] = useState("");
  const [isVote, setIsVote] = useState(false);
  const [motion, setMotion] = useState("");
  const [rule, setRule] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const position = (agenda.data?.length ?? 0) ? Math.max(...agenda.data!.map((a) => a.position)) + 1 : 0;
    const { error } = await attempt(db.agenda.add({ title, presenter: presenter || null, position, meeting_id: meetingId, organization_id: org.id,
      is_vote_item: isVote, proposed_motion: isVote ? motion.trim() || null : null, decision_rule: isVote ? rule : null }));
    if (error) { toast.error(errorMessage(error)); return; }
    setTitle("");
    setPresenter("");
    setIsVote(false);
    setMotion("");
    setRule(null);
    invalidate("agenda");
  }

  async function move(item: Item, dir: -1 | 1) {
    const list = agenda.data ?? [];
    const i = list.findIndex((a) => a.id === item.id);
    const other = list[i + dir];
    if (!other) return;
    await attempt(db.agenda.update(item.id, { position: other.position }));
    await attempt(db.agenda.update(other.id, { position: item.position === other.position ? item.position + dir : item.position }));
    invalidate("agenda");
  }

  async function remove(item: Item) {
    if (!confirm(`Remove "${item.title}" from the agenda?`)) return;
    const { error } = await attempt(db.agenda.remove(item.id));
    if (error) { toast.error(errorMessage(error)); return; }
    invalidate("agenda", "motions");
  }

  if (agenda.isLoading) return <LoadingState />;
  return (
    <div className="space-y-4">
      {!agenda.data?.length && <EmptyState title="No agenda items yet" />}
      {agenda.data?.map((item, i) => (
        <div key={item.id} className="rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">Item {i + 1}</p>
              <h3 className="text-lg">{item.title}</h3>
              {item.presenter && <p className="text-sm text-muted-foreground">{item.presenter}</p>}
            </div>
            {editable && (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => move(item, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(item, 1)} disabled={i === agenda.data!.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(item)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <VoteItem item={item} editable={editable} orgRule={org.decision_rule} onSaved={() => invalidate("agenda")} />
          <NotesEditor item={item} editable={editable} />
        </div>
      ))}
      {editable && (
        <form onSubmit={add} className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="New agenda item" value={title} onChange={(e) => setTitle(e.target.value)} required className="min-w-56 flex-1" />
            <Input placeholder="Presenter (optional)" value={presenter} onChange={(e) => setPresenter(e.target.value)} className="w-48" />
          </div>
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="mb-1 text-sm font-medium">Is this a vote item?</legend>
            <label className="flex items-center gap-2"><input type="radio" name="vote-item" checked={!isVote} onChange={() => setIsVote(false)} />No — discussion or report</label>
            <label className="flex items-center gap-2"><input type="radio" name="vote-item" checked={isVote} onChange={() => setIsVote(true)} />Yes — the board will vote</label>
          </fieldset>
          {isVote && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="eyebrow" htmlFor="new-motion">Proposed motion</label><Input id="new-motion" value={motion} onChange={(e) => setMotion(e.target.value)} placeholder="To approve…" className="mt-1" /></div>
              <div><label className="eyebrow" htmlFor="new-rule">Decision rule</label><RuleSelect id="new-rule" value={rule} orgRule={org.decision_rule} onChange={setRule} /></div>
            </div>
          )}
          <Button type="submit">Add item</Button>
        </form>
      )}
    </div>
  );
}

function NotesEditor({ item, editable }: { item: Item; editable: boolean }) {
  const [value, setValue] = useState(item.notes);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onChange(v: string) {
    setValue(v);
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState("saving");
      const { error } = await attempt(db.agenda.update(item.id, { notes: v }));
      setState(error ? "error" : "saved");
      if (error) toast.error("Notes didn't save: " + errorMessage(error));
    }, 800);
  }

  return (
    <div className="mt-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!editable}
        placeholder={editable ? "Discussion notes for this item…" : "No notes"}
        className="min-h-24 bg-background"
      />
      {editable && (
        <p className="mt-1 text-right font-mono text-[11px] text-muted-foreground">
          {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "error" ? "Not saved" : "Editing…"}
        </p>
      )}
    </div>
  );
}

function VoteItem({ item, editable, orgRule, onSaved }: { item: Item; editable: boolean; orgRule: string; onSaved: () => void }) {
  const [value, setValue] = useState(item.proposed_motion ?? "");
  const ruleLabel = DECISION_RULES[(item.decision_rule ?? orgRule) as DecisionRule];
  async function save(patch: { is_vote_item?: boolean; proposed_motion?: string | null; decision_rule?: string | null }) {
    const { error } = await attempt(db.agenda.update(item.id, patch));
    if (error) { toast.error(errorMessage(error)); return; }
    onSaved();
  }
  if (!editable) {
    if (!item.is_vote_item) return null;
    return (
      <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm">
        <span className="eyebrow">Vote item · {ruleLabel}{item.decision_rule ? "" : " (default)"}</span>
        {item.proposed_motion && <p>{item.proposed_motion}</p>}
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={item.is_vote_item} onChange={(e) => save({ is_vote_item: e.target.checked, ...(e.target.checked ? {} : { decision_rule: null }) })} />
        Vote item
      </label>
      {item.is_vote_item && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="eyebrow" htmlFor={`pm-${item.id}`}>Proposed motion</label>
            <Input id={`pm-${item.id}`} value={value} onChange={(e) => setValue(e.target.value)}
              onBlur={() => { if ((item.proposed_motion ?? "") !== value.trim()) void save({ proposed_motion: value.trim() || null }); }}
              placeholder="To approve…" className="mt-1 bg-background" />
          </div>
          <div><label className="eyebrow" htmlFor={`rule-${item.id}`}>Decision rule</label><RuleSelect id={`rule-${item.id}`} value={item.decision_rule} orgRule={orgRule} onChange={(v) => save({ decision_rule: v })} /></div>
        </div>
      )}
    </div>
  );
}
