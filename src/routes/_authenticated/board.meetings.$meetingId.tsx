import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { useMeeting, useMinutes, useInvalidateMeeting } from "@/lib/meeting-data";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgendaTab } from "@/components/meeting/AgendaTab";
import { AttendanceTab } from "@/components/meeting/AttendanceTab";
import { MotionsTab } from "@/components/meeting/MotionsTab";
import { MinutesTab } from "@/components/meeting/MinutesTab";
import { PacketTab } from "@/components/meeting/PacketTab";
import { MeetingActionsTab } from "@/components/meeting/MeetingActionsTab";

const TABS = ["agenda", "attendance", "motions", "minutes", "packet", "actions"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/board/meetings/$meetingId")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : undefined,
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
  if (!meeting.data || meeting.data.organization_id !== org.id)
    return <EmptyState title="Meeting not found">It may belong to another organization. <Link to="/board/meetings" className="text-primary underline">Back to meetings</Link></EmptyState>;

  const m = meeting.data;
  const approved = (minutes.data ?? []).some((v) => v.status === "approved");
  const locked = approved || m.status === "archived";
  const editable = can(org.role, "records.edit") && !locked;

  async function setStatus(status: string) {
    const { error } = await supabase.from("meetings").update({ status: status as typeof m.status }).eq("id", m.id);
    if (error) return toast.error(errorMessage(error));
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
            <Select value={m.status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft", "scheduled", "in_progress", "completed", "archived"].map((s) => (
                  <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <StatusBadge status={m.status} />
        }
      >
        {locked && <span className="text-warning">This meeting's record is {approved ? "approved" : "archived"} — attendance and motions are locked.</span>}
      </PageHeader>
      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="agenda">Agenda & notes</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="motions">Motions & votes</TabsTrigger>
          <TabsTrigger value="minutes">Minutes</TabsTrigger>
          <TabsTrigger value="packet">Board packet</TabsTrigger>
          <TabsTrigger value="actions">Action items</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda"><AgendaTab meetingId={m.id} editable={editable} /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab meetingId={m.id} editable={editable} /></TabsContent>
        <TabsContent value="motions"><MotionsTab meetingId={m.id} editable={editable} /></TabsContent>
        <TabsContent value="minutes"><MinutesTab meeting={m} /></TabsContent>
        <TabsContent value="packet"><PacketTab meeting={m} /></TabsContent>
        <TabsContent value="actions"><MeetingActionsTab meetingId={m.id} /></TabsContent>
      </Tabs>
    </>
  );
}
