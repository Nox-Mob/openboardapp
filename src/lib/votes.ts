/** Motion voting helpers: who can move/second, roll-call tallies. */
export type VoteRecording = "totals" | "roll_call";
export type Vote = "yes" | "no" | "abstain";
export interface RollCallEntry { attendance_id: string; person_name: string; vote: Vote }

interface Attendee { id: string; person_name: string; status: string; is_voting: boolean }

/** Only people marked present (in person or remote) can move, second or vote. */
export function presentAttendees<T extends Attendee>(list: T[]): T[] {
  return list.filter((a) => a.status === "present" || a.status === "remote");
}

/** Roll call covers present voting members only. */
export function rollCallVoters<T extends Attendee>(list: T[]): T[] {
  return presentAttendees(list).filter((a) => a.is_voting);
}

export function tally(roll: RollCallEntry[]) {
  return {
    votes_yes: roll.filter((r) => r.vote === "yes").length,
    votes_no: roll.filter((r) => r.vote === "no").length,
    votes_abstain: roll.filter((r) => r.vote === "abstain").length,
  };
}

/** Reads stored roll-call JSON safely. */
export function parseRollCall(raw: unknown): RollCallEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const o = r as { attendance_id?: unknown; person_name?: unknown; vote?: unknown } | null;
    if (!o || typeof o.person_name !== "string" || !["yes", "no", "abstain"].includes(o.vote as string)) return [];
    return [{ attendance_id: String(o.attendance_id ?? ""), person_name: o.person_name, vote: o.vote as Vote }];
  });
}

const LABEL: Record<Vote, string> = { yes: "in favor", no: "opposed", abstain: "abstaining" };
export function formatRollCall(roll: RollCallEntry[]): string {
  return (["yes", "no", "abstain"] as Vote[])
    .map((v) => { const names = roll.filter((r) => r.vote === v).map((r) => r.person_name); return names.length ? `${LABEL[v]}: ${names.join(", ")}` : ""; })
    .filter(Boolean)
    .join("; ");
}
