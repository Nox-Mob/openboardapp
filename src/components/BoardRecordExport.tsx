import { useState } from "react";
import { toast } from "sonner";
import { zipSync, strToU8 } from "fflate";
import { db } from "@/data";
import { attendanceCsv, folderNames, packetAsOf, rangeError, safeName, tookPlace, versionAsOf, votesCsv, yearToDate } from "@/lib/board-export";
import { downloadBlob, errorMessage } from "@/lib/export";
import { minutesToPdf } from "@/lib/packet";
import { loadLetterhead } from "@/lib/load-letterhead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Builds a zip with one folder per meeting: approved minutes, vote records, attendance and the packet as of the meeting. */
export function BoardRecordExport({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [range, setRange] = useState(yearToDate);
  const [busy, setBusy] = useState<string | null>(null);
  const problem = rangeError(range.from, range.to);

  async function run() {
    if (problem) { toast.error(problem); return; }
    try {
      setBusy("Gathering meetings…");
      const { meetings, documents } = await db.records.forRange(orgId, range.from, range.to);
      const held = meetings.filter((m) => tookPlace(m.status));
      if (!held.length) { toast.error("No meetings took place in that period"); return; }
      const names = folderNames(held);
      const files: Record<string, Uint8Array> = {};
      const letterhead = await loadLetterhead(orgId);
      const index: string[] = [`${orgName} - Board record ${range.from} to ${range.to}`, `Exported ${new Date().toISOString()}`, ""];
      for (const [i, m] of held.entries()) {
        setBusy(`Meeting ${i + 1} of ${held.length}…`);
        const dir = names[i] + "/";
        const approved = m.minutes.find((v) => v.status === "approved");
        if (approved) {
          files[dir + `minutes-v${approved.version}.pdf`] = await minutesToPdf({ orgName, meetingTitle: m.title, meetingDate: m.meeting_date, version: approved.version, status: "approved", approvedAt: approved.approved_at, content: approved.content, letterhead });
          files[dir + `minutes-v${approved.version}.txt`] = strToU8(approved.content);
        } else files[dir + "minutes-NOT-APPROVED.txt"] = strToU8("No approved minutes exist for this meeting.");
        files[dir + "votes.csv"] = strToU8(votesCsv([...m.motions].sort((a, b) => a.created_at.localeCompare(b.created_at))));
        files[dir + "attendance.csv"] = strToU8(attendanceCsv(m.attendance));
        const packet = packetAsOf(m.packets, m.meeting_date);
        if (packet) {
          const bytes = await db.files.download(packet.storage_path);
          if (bytes) files[dir + `board-packet/packet-v${packet.version}.pdf`] = new Uint8Array(bytes);
        }
        for (const d of documents.filter((x) => x.meeting_id === m.id)) {
          const v = versionAsOf(d.document_versions, m.meeting_date);
          if (!v) continue;
          const bytes = await db.files.download(v.storage_path);
          if (bytes) files[dir + `board-packet/${safeName(d.title)} (v${v.version}) - ${safeName(v.file_name)}`] = new Uint8Array(bytes);
        }
        index.push(`${names[i]}: ${approved ? `minutes v${approved.version} approved` : "minutes not approved"}, ${m.motions.length} motion(s), ${packet ? `packet v${packet.version}` : "no packet"}`);
      }
      files["README.txt"] = strToU8(index.join("\n"));
      const zip = zipSync(files, { level: 6 });
      downloadBlob(new Blob([zip as unknown as BlobPart], { type: "application/zip" }), `${safeName(orgName)}-board-record-${range.from}-to-${range.to}.zip`);
      toast.success(`Exported ${held.length} meeting${held.length === 1 ? "" : "s"}`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">Full board record (zip)</p>
      <p className="text-sm text-muted-foreground">One folder per meeting held: approved minutes, vote records, attendance and the board packet as it stood on the meeting day. Up to one year at a time.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label htmlFor="exp-from">From</Label><Input id="exp-from" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><Label htmlFor="exp-to">To</Label><Input id="exp-to" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        <Button variant="ghost" size="sm" onClick={() => setRange(yearToDate())}>Year to date</Button>
      </div>
      {problem && <p className="text-sm font-medium text-destructive">{problem}</p>}
      <Button onClick={run} disabled={!!busy || !!problem}>{busy ?? "Download board record (.zip)"}</Button>
    </div>
  );
}
