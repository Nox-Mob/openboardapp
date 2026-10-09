/** Full Board Record export: rules for the date range and what goes into each meeting folder. */
import { toCsv } from "./export";
import { parseRollCall, parseVoteRecord, VOTE_LABEL } from "./votes";

export const MAX_RANGE_DAYS = 366;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Default range: January 1 of this year through today. */
export function yearToDate(today: Date = new Date()): { from: string; to: string } {
  return { from: `${today.getUTCFullYear()}-01-01`, to: iso(today) };
}

/** Returns an error message, or null when the range is allowed (start before end, at most one year). */
export function rangeError(from: string, to: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "Choose a start and end date";
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days < 0) return "The start date must be on or before the end date";
  if (days > MAX_RANGE_DAYS - 1) return "The export can cover at most one year";
  return null;
}

/** Only meetings that actually took place: in progress, completed or archived. */
export function tookPlace(status: string): boolean {
  return status === "in_progress" || status === "completed" || status === "archived";
}

/** Latest packet created on or before the meeting day (distributed packets preferred). */
export function packetAsOf<T extends { created_at: string; distributed_at: string | null; version: number }>(packets: T[], meetingDate: string): T | undefined {
  const end = Date.parse(meetingDate + "T23:59:59.999Z");
  const eligible = packets.filter((p) => Date.parse(p.created_at) <= end).sort((a, b) => b.version - a.version);
  return eligible.find((p) => p.distributed_at) ?? eligible[0];
}

/** Version of a document that existed on the meeting day. */
export function versionAsOf<T extends { created_at: string; version: number }>(versions: T[], meetingDate: string): T | undefined {
  const end = Date.parse(meetingDate + "T23:59:59.999Z");
  return versions.filter((v) => Date.parse(v.created_at) <= end).sort((a, b) => b.version - a.version)[0];
}

export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";
}

/** Unique folder names: "2026-09-14 Regular board meeting", with " (2)" for repeats. */
export function folderNames(meetings: { meeting_date: string; title: string }[]): string[] {
  const seen = new Map<string, number>();
  return meetings.map((m) => {
    const base = safeName(`${m.meeting_date} ${m.title}`);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

interface MotionLike {
  motion_text: string; moved_by: string | null; seconded_by: string | null;
  votes_yes: number; votes_no: number; votes_abstain: number; votes_recused?: number;
  outcome: string; roll_call: unknown; vote_record: unknown; disposition_note: string | null;
  opened_at?: string | null; closed_at?: string | null;
}

export function votesCsv(motions: MotionLike[]): string {
  return toCsv(motions.map((m) => {
    const r = parseVoteRecord(m.vote_record);
    return {
      motion: m.motion_text, moved_by: m.moved_by ?? "", seconded_by: m.seconded_by ?? "",
      in_favor: m.votes_yes, opposed: m.votes_no, abstaining: m.votes_abstain, recused: m.votes_recused ?? 0,
      how_each_voted: parseRollCall(m.roll_call).map((v) => `${v.person_name}: ${VOTE_LABEL[v.vote]}`).join("; "),
      eligible_voters: r?.electorate?.join("; ") ?? "", did_not_vote: r?.not_voting?.join("; ") ?? "",
      quorum: r ? `${r.present_voting} of ${r.quorum_required} (${r.quorum_met ? "met" : "not met"})` : "",
      decision_rule: r?.decision_rule ?? "", outcome: m.outcome, result_note: m.disposition_note ?? "",
      opened_at: m.opened_at ?? "", closed_at: m.closed_at ?? "",
    };
  })) || "motion\n";
}

export function attendanceCsv(rows: { person_name: string; status: string; is_voting: boolean; role_label?: string | null }[]): string {
  return toCsv(rows.map((a) => ({ name: a.person_name, status: a.status, voting_member: a.is_voting ? "yes" : "no" }))) || "name,status,voting_member\n";
}
