import { ActionItems } from "@/components/ActionItems";

export function MeetingActionsTab({ meetingId }: { meetingId: string }) {
  return <ActionItems meetingId={meetingId} />;
}
