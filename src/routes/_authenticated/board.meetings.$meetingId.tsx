import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { useMeeting, useMinutes, useInvalidateMeeting } from "@/lib/meeting-data";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgendaTab } from "@/components/meeting/AgendaTab";
import { AttendanceTab } from "@/components/meeting/AttendanceTab";
import { MotionsTab } from "@/components/meeting/MotionsTab";
import { MinutesTab } from "@/components/meeting/MinutesTab";
import { PacketTab } from "@/components/meeting/PacketTab";
import { SaveAsTemplate } from "@/components/meeting/SaveAsTemplate";
import { MeetingActionsTab } from "@/components/meeting/MeetingActionsTab";

const TABS = ["agenda", "attendance", "motions", "minutes", "packet", "actions"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/board/meetings/$meetingId")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {},
  head: () => ({
    meta: [
      { title: "Meeting record — OpenBoardApp" },
      {
        name: "description",
        content: "Prepare agendas, record attendance and approve meeting minutes.",
      },
      { property: "og:title", content: "Meeting record — OpenBoardApp" },
      {
        property: "og:description",
        content: "Prepare agendas, record attendance and approve meeting minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeetingPage,
});

function MeetingPage() {
  const { meetingId } = Route.useParams();
  const { tab = "agenda" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { org } = useCurrentOrg();
  const meeting = useMeeting(meetingId);
  const minutes = useMinutes(meetingId);
  const invalidate = useInvalidateMeeting(meetingId);

  if (meeting.isLoading) return <LoadingState />;
  if (meeting.error) return <ErrorState error={meeting.error} />;
  if (!meeting.data || meeting.data.org_id !== org.id)
    return (
      <EmptyState title="Meeting not found">
        It may belong to another organization.{" "}
        <Link to="/board/meetings" className="text-primary underline">
          Back to meetings
        </Link>
      </EmptyState>
    );

  const m = meeting.data;
  const approved = (minutes.data ?? []).some((v) => v.status === "approved");
  const locked = approved || m.status === "archived";
  const editable = can(org.role, "records.edit") && !locked;

  async function setStatus(status: string) {
    const { error } = await attempt(db.meetings.setStatus(m.id, status as typeof m.status));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    invalidate("meeting");
    toast.success("Meeting status updated");
  }

  return (
    <>
      <PageHeader
        eyebrow={`${m.meeting_date}${m.start_time ? " · " + m.start_time : ""}${m.location ? " · " + m.location : ""}`}
        title={m.title}
        actions={
          can(org.role, "records.edit") ? (
            <div className="flex gap-2">
              <SaveAsTemplate meeting={m} />
              <Select value={m.status} onValueChange={setStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft", "scheduled", "in_progress", "completed", "archived"].map((s) => (
                    <SelectItem key={s} value={s}>
                      <StatusBadge status={s} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <StatusBadge status={m.status} />
          )
        }
      >
        {locked && (
          <span className="text-warning">
            This meeting's record is {approved ? "approved" : "archived"} — attendance and motions
            are locked.
          </span>
        )}
        {m.status === "in_progress" && (
          <Link
            to="/board/live/$meetingId"
            params={{ meetingId: m.id }}
            className="mt-2 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Join meeting — Board Meeting Dashboard
          </Link>
        )}
      </PageHeader>
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}
      >
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="agenda">Agenda & notes</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="motions">Motions & votes</TabsTrigger>
          <TabsTrigger value="minutes">Minutes</TabsTrigger>
          <TabsTrigger value="packet">Board packet</TabsTrigger>
          <TabsTrigger value="actions">Action items</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda">
          <AgendaTab meetingId={m.id} editable={editable} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab meetingId={m.id} editable={editable} />
        </TabsContent>
        <TabsContent value="motions">
          <MotionsTab meetingId={m.id} editable={editable} />
        </TabsContent>
        <TabsContent value="minutes">
          <MinutesTab meeting={m} />
        </TabsContent>
        <TabsContent value="packet">
          <PacketTab meeting={m} />
        </TabsContent>
        <TabsContent value="actions">
          <MeetingActionsTab meetingId={m.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}
