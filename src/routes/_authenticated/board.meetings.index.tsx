import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { useTemplates } from "@/lib/meeting-data";
import { STANDARD_AGENDA } from "@/lib/templates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { PageHeader, LoadingState, EmptyState, ErrorState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/board/meetings/")({
  head: () => ({
    meta: [
      { title: "Meetings — OpenBoard" },
      { name: "description", content: "Schedule and review your organization’s board meetings." },
      { property: "og:title", content: "Meetings — OpenBoard" },
      {
        property: "og:description",
        content: "Schedule and review your organization’s board meetings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Meetings,
});

function Meetings() {
  const { org, userId } = useCurrentOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "Regular Board Meeting",
    meeting_date: "",
    start_time: "18:30",
    location: "",
  });
  const q = useQuery({
    queryKey: ["meetings", org.id],
    queryFn: () => db.meetings.list(org.id),
  });
  const templates = useTemplates(org.id);
  const [templateId, setTemplateId] = useState("standard");
  const chosen = templates.data?.find((t) => t.id === templateId);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.data?.find((x) => x.id === id);
    if (t)
      setForm((f) => ({
        ...f,
        title: t.meeting_title,
        start_time: t.start_time ?? f.start_time,
        location: t.location ?? "",
      }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const agenda = chosen ? chosen.agenda : STANDARD_AGENDA;
    const { data, error } = await attempt(
      db.meetings.create(
        { ...form, organization_id: org.id, created_by: userId, status: "scheduled" },
        agenda,
      ),
    );
    if (error !== null) {
      toast.error(errorMessage(error));
      return;
    }
    setOpen(false);
    navigate({ to: "/board/meetings/$meetingId", params: { meetingId: data } });
  }

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Meetings"
        actions={
          can(org.role, "records.edit") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New meeting</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule a meeting</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div>
                    <Label>Start from</Label>
                    <Select value={templateId} onValueChange={pickTemplate}>
                      <SelectTrigger aria-label="Meeting template">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard agenda</SelectItem>
                        {templates.data?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={form.meeting_date}
                        onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Start time</Label>
                      <Input
                        type="time"
                        value={form.start_time}
                        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Community hall or video link"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(chosen ? chosen.agenda : STANDARD_AGENDA).length} agenda items are added for
                    you — edit them on the next screen.{" "}
                    <Link to="/board/templates" className="text-primary underline">
                      Manage templates
                    </Link>
                  </p>
                  <Button type="submit" className="w-full">
                    Create meeting
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : !q.data?.length ? (
        <EmptyState title="No meetings yet">
          Schedule your first board meeting to start building an agenda.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="eyebrow px-4 py-2">Date</th>
                <th className="eyebrow px-4 py-2">Meeting</th>
                <th className="eyebrow px-4 py-2">Location</th>
                <th className="eyebrow px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.map((m) => (
                <tr key={m.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs">{m.meeting_date}</td>
                  <td className="px-4 py-3">
                    <Link
                      to="/board/meetings/$meetingId"
                      params={{ meetingId: m.id }}
                      className="font-medium hover:text-primary"
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.location}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
