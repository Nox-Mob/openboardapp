import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg, useOrgMembers } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

export function ActionItems({ meetingId, mineOnly }: { meetingId?: string; mineOnly?: boolean }) {
  const { org, userId } = useCurrentOrg();
  const members = useOrgMembers(org.id);
  const qc = useQueryClient();
  const editor = can(org.role, "records.edit");
  const [f, setF] = useState({ title: "", assignee_id: "", due_date: "" });
  const today = new Date().toLocaleDateString("en-CA");
  const key = ["actions", org.id, meetingId ?? "all", mineOnly ? "mine" : "any"];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      let query = supabase.from("action_items").select("*, meetings(title, meeting_date)").eq("organization_id", org.id);
      if (meetingId) query = query.eq("meeting_id", meetingId);
      if (mineOnly) query = query.eq("assignee_id", userId);
      const { data, error } = await query.order("due_date", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["actions", org.id] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("action_items").insert({
      title: f.title, assignee_id: f.assignee_id || null, due_date: f.due_date || null,
      meeting_id: meetingId ?? null, organization_id: org.id, created_by: userId,
    });
    if (error) { toast.error(errorMessage(error)); return; }
    setF({ title: "", assignee_id: "", due_date: "" });
    refresh();
  }

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("action_items").update({ status }).eq("id", id);
    if (error) { toast.error(errorMessage(error)); return; }
    refresh();
  }

  const nameOf = (id: string | null) => members.data?.find((m) => m.user_id === id)?.name ?? "Unassigned";
  if (q.isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      {editor && (
        <form onSubmit={add} className="grid gap-2 rounded-lg border bg-card p-4 md:grid-cols-[1fr_200px_160px_auto]">
          <Input placeholder="What needs to happen?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          <Select value={f.assignee_id} onValueChange={(v) => setF({ ...f, assignee_id: v })}>
            <SelectTrigger><SelectValue placeholder="Assign to…" /></SelectTrigger>
            <SelectContent>{members.data?.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          <Button type="submit">Add</Button>
        </form>
      )}
      {!q.data?.length ? <EmptyState title="No action items" /> : (
        <div className="divide-y rounded-lg border bg-card">
          {q.data.map((t) => {
            const overdue = t.due_date && t.due_date < today && (t.status === "open" || t.status === "in_progress");
            const mtg = t.meetings as { title: string; meeting_date: string } | null;
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className={`font-medium ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(t.assignee_id)} · {t.due_date ? `due ${t.due_date}` : "no due date"}
                    {!meetingId && mtg && t.meeting_id && (
                      <> · from <Link to="/board/meetings/$meetingId" params={{ meetingId: t.meeting_id }} className="underline">{mtg.title} ({mtg.meeting_date})</Link></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {overdue && <Badge variant="destructive">Overdue</Badge>}
                  <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as Status)} disabled={!editor && t.assignee_id !== userId}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
