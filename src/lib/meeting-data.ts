import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/data";

export function useMeeting(meetingId: string) {
  return useQuery({ queryKey: ["meeting", meetingId], queryFn: () => db.meetings.get(meetingId) });
}

export function useAgenda(meetingId: string) {
  return useQuery({ queryKey: ["agenda", meetingId], queryFn: () => db.agenda.list(meetingId) });
}

export function useAttendance(meetingId: string) {
  return useQuery({
    queryKey: ["attendance", meetingId],
    queryFn: () => db.attendance.list(meetingId),
  });
}

export function useMotions(meetingId: string) {
  return useQuery({ queryKey: ["motions", meetingId], queryFn: () => db.motions.list(meetingId) });
}

export function useMinutes(meetingId: string) {
  return useQuery({ queryKey: ["minutes", meetingId], queryFn: () => db.minutes.list(meetingId) });
}

export function useTemplates(orgId: string) {
  return useQuery({ queryKey: ["templates", orgId], queryFn: () => db.templates.list(orgId) });
}

export function useInvalidateMeeting(meetingId: string) {
  const qc = useQueryClient();
  return (...keys: string[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, meetingId] }));
}

export function signedUrl(path: string) {
  return db.files.signedUrl(path);
}
