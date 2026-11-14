import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { attempt, db } from "@/data";
import { useCurrentOrg, useOrgMembers, useTitles } from "@/lib/org-context";
import { errorMessage } from "@/lib/export";
import { useAttendance, useInvalidateMeeting } from "@/lib/meeting-data";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["present", "remote", "absent", "excused"] as const;

export function AttendanceTab({ meetingId, editable }: { meetingId: string; editable: boolean }) {
  const { org } = useCurrentOrg();
  const att = useAttendance(meetingId);
  const members = useOrgMembers(org.id);
  const titles = useTitles(org.id);
  const invalidate = useInvalidateMeeting(meetingId);
  const [guest, setGuest] = useState("");

  const present = (att.data ?? []).filter(
    (a) => a.status === "present" || a.status === "remote",
  ).length;

  async function addMembers() {
    const existing = new Set((att.data ?? []).map((a) => a.user_id));
    const rows = (members.data ?? [])
      .filter((m) => !existing.has(m.user_id) && m.role !== "observer")
      .map((m) => ({
        meeting_id: meetingId,
        org_id: org.id,
        user_id: m.user_id,
        person_name: m.name,
        status: "absent" as const,
      }));
    if (!rows.length) {
      toast.info("Everyone is already on the list");
      return;
    }
    const { error } = await attempt(db.attendance.add(rows));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    invalidate("attendance");
  }

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await attempt(
      db.attendance.add({
        meeting_id: meetingId,
        org_id: org.id,
        person_name: guest,
        status: "present",
        is_voting: false,
      }),
    );
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setGuest("");
    invalidate("attendance");
  }

  async function update(
    id: string,
    patch: { status?: (typeof STATUSES)[number]; is_voting?: boolean; user_id?: string },
  ) {
    const { error } = await attempt(db.attendance.update(id, patch));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    invalidate("attendance");
  }

  async function remove(id: string) {
    const { error } = await attempt(db.attendance.remove(id));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    invalidate("attendance");
  }

  if (att.isLoading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-4 text-sm ${present >= org.quorum_count ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}
      >
        <strong>{present}</strong> present · quorum requires <strong>{org.quorum_count}</strong> —{" "}
        {present >= org.quorum_count ? "quorum is met." : "quorum is not met yet."}
      </div>
      {editable && (
        <Button variant="outline" onClick={addMembers}>
          Add all board members
        </Button>
      )}
      {!att.data?.length ? (
        <EmptyState title="No attendance recorded" />
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {att.data.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{titles.label(a.person_name, a.user_id)}</p>
                {!a.is_voting && (
                  <p className="text-xs text-muted-foreground">Guest / non-voting</p>
                )}
                {a.is_voting && !a.user_id && (
                  <select
                    aria-label={`Link ${a.person_name} to an account`}
                    className="mt-1 h-8 rounded-md border bg-background px-2 text-xs"
                    value=""
                    disabled={!editable}
                    onChange={(e) => e.target.value && update(a.id, { user_id: e.target.value })}
                  >
                    <option value="">No account linked — can't vote live</option>
                    {(members.data ?? []).map((mb) => (
                      <option key={mb.user_id} value={mb.user_id}>
                        {titles.label(mb.name, mb.user_id)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={a.status}
                  onValueChange={(v) => update(a.id, { status: v as (typeof STATUSES)[number] })}
                  disabled={!editable}
                >
                  <SelectTrigger
                    className="w-32"
                    aria-label={`Attendance for ${titles.label(a.person_name, a.user_id)}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editable && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(a.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {editable && (
        <form onSubmit={addGuest} className="flex gap-2">
          <Input
            placeholder="Add a guest by name"
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            required
          />
          <Button type="submit" variant="secondary">
            Add guest
          </Button>
        </form>
      )}
    </div>
  );
}
