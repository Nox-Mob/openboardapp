import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { useCurrentOrg, useOrgMembers, useTitles } from "@/lib/org-context";

import { errorMessage } from "@/lib/export";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

export function ActionItems({ meetingId, mineOnly }: { meetingId?: string; mineOnly?: boolean }) {
  const { org, userId, can, readOnly } = useCurrentOrg();
  const members = useOrgMembers(org.id);
  const titles = useTitles(org.id);
  const qc = useQueryClient();
  const editor = can("records.edit");
  const [f, setF] = useState({ title: "", assignee_id: "", due_date: "" });
  const today = new Date().toLocaleDateString("en-CA");
  const key = ["actions", org.id, meetingId ?? "all", mineOnly ? "mine" : "any"];

  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      db.actions.list(org.id, { meetingId, assigneeId: mineOnly ? userId : undefined }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["actions", org.id] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await attempt(
      db.actions.add({
        title: f.title,
        assignee_id: f.assignee_id || null,
        due_date: f.due_date || null,
        meeting_id: meetingId ?? null,
        org_id: org.id,
        created_by: userId,
      }),
    );
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setF({ title: "", assignee_id: "", due_date: "" });
    refresh();
  }

  async function setStatus(id: string, status: Status) {
    const { error } = await attempt(db.actions.setStatus(id, status));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  }

  const nameOf = (id: string | null) => {
    const m = members.data?.find((x) => x.user_id === id);
    return m ? titles.label(m.name, m.user_id) : "Unassigned";
  };
  if (q.isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      {editor && (
        <form
          onSubmit={add}
          className="grid gap-2 rounded-lg border bg-card p-4 md:grid-cols-[1fr_200px_160px_auto]"
        >
          <Input
            aria-label="Action item"
            placeholder="What needs to happen?"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            required
          />
          <Select value={f.assignee_id} onValueChange={(v) => setF({ ...f, assignee_id: v })}>
            <SelectTrigger aria-label="Assign to">
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent>
              {members.data?.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {titles.label(m.name, m.user_id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            aria-label="Due date"
            value={f.due_date}
            onChange={(e) => setF({ ...f, due_date: e.target.value })}
          />
          <Button type="submit">Add</Button>
        </form>
      )}
      {!q.data?.length ? (
        <EmptyState title="No action items" />
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {q.data.map((t) => {
            const overdue =
              t.due_date &&
              t.due_date < today &&
              (t.status === "open" || t.status === "in_progress");
            const mtg = t.meetings as { title: string; meeting_date: string } | null;
            return (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p
                    className={`font-medium ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}
                  >
                    {t.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(t.assignee_id)} · {t.due_date ? `due ${t.due_date}` : "no due date"}
                    {!meetingId && mtg && t.meeting_id && (
                      <>
                        {" "}
                        · from{" "}
                        <Link
                          to="/board/meetings/$meetingId"
                          params={{ meetingId: t.meeting_id }}
                          className="underline"
                        >
                          {mtg.title} ({mtg.meeting_date})
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {overdue && <Badge variant="destructive">Overdue</Badge>}
                  <Select
                    value={t.status}
                    onValueChange={(v) => setStatus(t.id, v as Status)}
                    disabled={readOnly || (!editor && t.assignee_id !== userId)}
                  >
                    <SelectTrigger className="w-36" aria-label={`Status of ${t.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
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
