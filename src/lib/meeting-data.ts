import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMeeting(meetingId: string) {
  return useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").eq("id", meetingId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAgenda(meetingId: string) {
  return useQuery({
    queryKey: ["agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agenda_items").select("*").eq("meeting_id", meetingId).order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useAttendance(meetingId: string) {
  return useQuery({
    queryKey: ["attendance", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").eq("meeting_id", meetingId).order("person_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useMotions(meetingId: string) {
  return useQuery({
    queryKey: ["motions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("motions").select("*").eq("meeting_id", meetingId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useMinutes(meetingId: string) {
  return useQuery({
    queryKey: ["minutes", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("minutes").select("*").eq("meeting_id", meetingId).order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateMeeting(meetingId: string) {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, meetingId] }));
}

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from("org-files").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
