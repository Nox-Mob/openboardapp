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

type Item = NonNullable<ReturnType<typeof useAgenda>["data"]>[number];

export function AgendaTab({ meetingId, editable }: { meetingId: string; editable: boolean }) {
  const { org } = useCurrentOrg();
  const agenda = useAgenda(meetingId);
  const invalidate = useInvalidateMeeting(meetingId);
  const [title, setTitle] = useState("");
  const [presenter, setPresenter] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const position = (agenda.data?.length ?? 0) ? Math.max(...agenda.data!.map((a) => a.position)) + 1 : 0;
    const { error } = await attempt(db.agenda.add({ title, presenter: presenter || null, position, meeting_id: meetingId, organization_id: org.id }));
    if (error) { toast.error(errorMessage(error)); return; }
    setTitle("");
    setPresenter("");
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
          <NotesEditor item={item} editable={editable} />
        </div>
      ))}
      {editable && (
        <form onSubmit={add} className="flex flex-wrap gap-2 rounded-lg border border-dashed p-4">
          <Input placeholder="New agenda item" value={title} onChange={(e) => setTitle(e.target.value)} required className="min-w-56 flex-1" />
          <Input placeholder="Presenter (optional)" value={presenter} onChange={(e) => setPresenter(e.target.value)} className="w-48" />
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
