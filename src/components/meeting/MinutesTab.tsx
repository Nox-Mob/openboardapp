import { useEffect, useState } from "react";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { useCurrentOrg, useOrgMembers } from "@/lib/org-context";

import { errorMessage, downloadBlob } from "@/lib/export";
import { generateMinutes, nextVersion } from "@/lib/minutes";
import { minutesToPdf } from "@/lib/packet";
import { loadLetterhead } from "@/lib/load-letterhead";
import {
  useAgenda,
  useAttendance,
  useMinutes,
  useMotions,
  useInvalidateMeeting,
} from "@/lib/meeting-data";
import type { Tables } from "@/integrations/supabase/types";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MinutesTab({ meeting }: { meeting: Tables<"meetings"> }) {
  const { org, userId, can } = useCurrentOrg();
  const minutes = useMinutes(meeting.id);
  const agenda = useAgenda(meeting.id);
  const att = useAttendance(meeting.id);
  const motions = useMotions(meeting.id);
  const members = useOrgMembers(org.id);
  const invalidate = useInvalidateMeeting(meeting.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const versions = minutes.data ?? [];
  const current = versions.find((v) => v.id === selected) ?? versions[0];
  useEffect(() => {
    if (current) setDraft(current.content);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = can("records.edit");
  const approver = can("minutes.approve");
  const nameOf = (id: string | null) =>
    members.data?.find((m) => m.user_id === id)?.name ?? "Unknown";

  async function createVersion(content: string) {
    const { data, error } = await attempt(
      db.minutes.create({
        meeting_id: meeting.id,
        org_id: org.id,
        version: nextVersion(versions),
        content,
        created_by: userId,
      }),
    );
    if (error !== null) {
      toast.error(errorMessage(error));
      return;
    }
    setSelected(data);
    invalidate("minutes");
  }

  function generate() {
    const text = generateMinutes({
      orgName: org.name,
      meeting,
      attendance: att.data ?? [],
      agenda: agenda.data ?? [],
      motions: motions.data ?? [],
      quorum: org.quorum_count,
    });
    void createVersion(text);
  }

  async function setStatus(status: "draft" | "submitted" | "approved", content?: string) {
    if (!current) return;
    const patch: { status: typeof status; content?: string } = { status };
    if (content !== undefined) patch.content = content;
    const { error } = await attempt(db.minutes.update(current.id, patch));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    invalidate("minutes");
    toast.success(
      status === "approved"
        ? "Minutes approved and locked"
        : status === "submitted"
          ? "Submitted for approval"
          : "Saved",
    );
  }

  async function exportPdf() {
    if (!current) return;
    try {
      const letterhead = await loadLetterhead(org.id);
      const bytes = await minutesToPdf({
        orgName: org.name,
        meetingTitle: meeting.title,
        meetingDate: meeting.meeting_date,
        version: current.version,
        status: current.status,
        approvedAt: current.approved_at,
        approvedBy: current.approved_by ? nameOf(current.approved_by) : null,
        content: current.content,
        letterhead,
      });
      downloadBlob(
        new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        `minutes-${meeting.meeting_date}-v${current.version}.pdf`,
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (minutes.isLoading) return <LoadingState />;

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <aside className="space-y-2">
        <p className="eyebrow">Versions</p>
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelected(v.id)}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${current?.id === v.id ? "border-primary bg-primary/5" : "bg-card"}`}
          >
            <span className="font-mono">v{v.version}</span> <StatusBadge status={v.status} />
            {v.approved_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                Approved {new Date(v.approved_at).toLocaleDateString()} by {nameOf(v.approved_by)}
              </p>
            )}
          </button>
        ))}
        {editor && (
          <Button variant="outline" className="w-full" onClick={generate}>
            Generate new draft from meeting
          </Button>
        )}
      </aside>
      <div className="lg:col-span-3">
        {!current ? (
          <EmptyState title="No minutes yet">
            Record attendance, notes and motions, then generate a draft. It pulls everything
            together for you.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {current.status === "draft" && editor ? (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="record-paper min-h-[28rem] p-6 text-sm"
              />
            ) : (
              <pre className="record-paper whitespace-pre-wrap p-8 text-sm">{current.content}</pre>
            )}
            {current.status !== "approved" ? (
              <p className="text-xs text-muted-foreground">
                Minutes go from draft to submitted (ready for the board to review) to approved.
                Approved minutes are the official record: they, the meeting&apos;s motions and its
                attendance can&apos;t be changed after that. To correct them, add an amended
                version.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {current.status === "draft" && editor && (
                <>
                  <Button variant="secondary" onClick={() => setStatus("draft", draft)}>
                    Save draft
                  </Button>
                  <Button onClick={() => setStatus("submitted", draft)}>Submit for approval</Button>
                </>
              )}
              {current.status === "submitted" && approver && (
                <>
                  <Button onClick={() => setStatus("approved")}>Approve as official minutes</Button>
                  <Button variant="outline" onClick={() => setStatus("draft")}>
                    Return to draft
                  </Button>
                </>
              )}
              {(current.status === "approved" || current.status === "superseded") && editor && (
                <Button variant="outline" onClick={() => createVersion(current.content)}>
                  Amend (create new version)
                </Button>
              )}
              <Button variant="ghost" onClick={exportPdf}>
                Download PDF
              </Button>
            </div>
            {current.status === "approved" && (
              <p className="text-sm text-muted-foreground">
                This is the official record. It can't be edited — amendments create a new version,
                and this one stays identifiable as v{current.version}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
