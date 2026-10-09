import { formatRollCall, parseRollCall, parseVoteRecord } from "./votes";

// Pure helpers for building formal minutes and handling versions.
export type MinutesStatus = "draft" | "submitted" | "approved" | "superseded";

export interface MinutesInput {
  orgName: string;
  meeting: { title: string; meeting_date: string; start_time?: string | null; location?: string | null };
  attendance: { person_name: string; status: string }[];
  agenda: { id: string; position: number; title: string; presenter?: string | null; notes: string }[];
  motions: {
    agenda_item_id: string | null;
    motion_text: string;
    moved_by?: string | null;
    seconded_by?: string | null;
    votes_yes: number;
    votes_no: number;
    votes_abstain: number;
    votes_recused?: number;
    outcome: string;
    roll_call?: unknown;
    vote_record?: unknown;
    disposition_note?: string | null;
  }[];
  quorum: number;
}

const OUTCOME: Record<string, string> = {
  carried: "CARRIED",
  failed: "FAILED",
  tabled: "TABLED",
  withdrawn: "WITHDRAWN",
  pending: "PENDING",
};

export function formatMotion(m: MinutesInput["motions"][number]): string {
  const roll = formatRollCall(parseRollCall(m.roll_call));
  const by = [m.moved_by && `Moved by ${m.moved_by}`, m.seconded_by && `seconded by ${m.seconded_by}`]
    .filter(Boolean)
    .join(", ");
  const rec = parseVoteRecord(m.vote_record);
  const rc = rec?.recused?.length ? ` Recused: ${rec.recused.join(", ")}.` : "";
  const nv = rec?.not_voting?.length ? ` Not voting: ${rec.not_voting.join(", ")}.` : "";
  const q = rec ? ` Eligible voters: ${rec.electorate?.length ?? 0}; quorum ${rec.quorum_met ? "met" : "not met"} (${rec.present_voting} of ${rec.quorum_required} required).` : "";
  const note = m.disposition_note ? ` Result recorded: ${m.disposition_note}.` : "";
  return `MOTION: ${m.motion_text}${by ? ` (${by})` : ""}. Vote: ${m.votes_yes} in favor, ${m.votes_no} opposed, ${m.votes_abstain} abstaining${m.votes_recused ? `, ${m.votes_recused} recused` : ""}.${roll ? ` Roll call — ${roll}.` : ""}${rc}${nv}${q} ${OUTCOME[m.outcome] ?? m.outcome.toUpperCase()}.${note}`;
}

export function generateMinutes(input: MinutesInput): string {
  const present = input.attendance.filter((a) => a.status === "present" || a.status === "remote");
  const absent = input.attendance.filter((a) => a.status === "absent" || a.status === "excused");
  const lines: string[] = [];
  lines.push(input.orgName.toUpperCase());
  lines.push(`Minutes of ${input.meeting.title}`);
  lines.push(
    [input.meeting.meeting_date, input.meeting.start_time, input.meeting.location].filter(Boolean).join(" · "),
  );
  lines.push("");
  lines.push(`Present: ${present.map((a) => a.person_name + (a.status === "remote" ? " (remote)" : "")).join(", ") || "None recorded"}`);
  if (absent.length) lines.push(`Absent: ${absent.map((a) => `${a.person_name}${a.status === "excused" ? " (excused)" : ""}`).join(", ")}`);
  lines.push(present.length >= input.quorum ? `A quorum was present (${present.length} of ${input.quorum} required).` : `A quorum was NOT present (${present.length} of ${input.quorum} required).`);
  lines.push("");
  const sorted = [...input.agenda].sort((a, b) => a.position - b.position);
  sorted.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}${item.presenter ? ` — ${item.presenter}` : ""}`);
    if (item.notes.trim()) lines.push(item.notes.trim());
    input.motions.filter((m) => m.agenda_item_id === item.id).forEach((m) => lines.push(formatMotion(m)));
    lines.push("");
  });
  const loose = input.motions.filter((m) => !m.agenda_item_id || !sorted.some((a) => a.id === m.agenda_item_id));
  if (loose.length) {
    lines.push("Other motions");
    loose.forEach((m) => lines.push(formatMotion(m)));
    lines.push("");
  }
  lines.push("Respectfully submitted,");
  lines.push("Secretary");
  return lines.join("\n");
}

export function nextVersion(versions: { version: number }[]): number {
  return versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
}

export function isEditable(status: MinutesStatus): boolean {
  return status === "draft";
}

export function currentApproved<T extends { status: MinutesStatus; version: number }>(versions: T[]): T | undefined {
  return versions.find((v) => v.status === "approved");
}
