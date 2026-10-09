/** Motion voting helpers: who can move/second, roll-call tallies. */
export type VoteRecording = "totals" | "roll_call";
export type Vote = "yes" | "no" | "abstain" | "recused";
export const VOTES: Vote[] = ["yes", "no", "abstain", "recused"];
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
    votes_recused: roll.filter((r) => r.vote === "recused").length,
  };
}

/** Reads stored roll-call JSON safely. */
export function parseRollCall(raw: unknown): RollCallEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const o = r as { attendance_id?: unknown; person_name?: unknown; vote?: unknown } | null;
    if (!o || typeof o.person_name !== "string" || !VOTES.includes(o.vote as Vote)) return [];
    return [{ attendance_id: String(o.attendance_id ?? ""), person_name: o.person_name, vote: o.vote as Vote }];
  });
}

const LABEL: Record<Vote, string> = { yes: "in favor", no: "opposed", abstain: "abstaining", recused: "recused" };
export function formatRollCall(roll: RollCallEntry[]): string {
  return VOTES
    .map((v) => { const names = roll.filter((r) => r.vote === v).map((r) => r.person_name); return names.length ? `${LABEL[v]}: ${names.join(", ")}` : ""; })
    .filter(Boolean)
    .join("; ");
}

// ---- Live voting (mirrors the database functions in migration 0003_live_voting) ----
export type DecisionRule = "majority_cast" | "majority_present" | "two_thirds_cast" | "chair";
export type CloseMode = "chair" | "auto" | "timer";

export const DECISION_RULES: Record<DecisionRule, string> = {
  majority_cast: "Simple majority of votes cast (abstentions don't count)",
  majority_present: "Majority of the eligible voters present",
  two_thirds_cast: "Two-thirds of votes cast",
  chair: "Custom — the chair records the result",
};

export const CLOSE_MODES: Record<CloseMode, string> = {
  chair: "The chair (or another permitted role) closes it",
  auto: "Closes automatically once every eligible member has voted",
  timer: "Closes when a timer runs out",
};

/** Wording used in the "this is your official vote" confirmation. */
export const VOTE_PHRASE: Record<Vote, string> = { yes: "in the affirmative", no: "in opposition", abstain: "to abstain", recused: "to recuse yourself (you will not take part in this decision)" };
export const VOTE_LABEL: Record<Vote, string> = { yes: "In favor", no: "Opposed", abstain: "Abstain", recused: "Recuse" };

/** Same rule the database applies on close; null means a person must record the result. */
export function computeDisposition(rule: string, c: { yes: number; no: number }, electorateSize: number, quorumMet: boolean, recused = 0): "carried" | "failed" | null {
  if (!quorumMet) return null;
  if (rule === "majority_cast") return c.yes + c.no > 0 ? (c.yes > c.no ? "carried" : "failed") : null;
  if (rule === "majority_present") return electorateSize - recused > 0 ? (c.yes * 2 > electorateSize - recused ? "carried" : "failed") : null;
  if (rule === "two_thirds_cast") return c.yes + c.no > 0 ? (c.yes * 3 >= (c.yes + c.no) * 2 ? "carried" : "failed") : null;
  return null;
}

/** Whether this role may close an open vote early under the org's settings. */
export function canCloseEarly(role: string | null | undefined, org: { vote_close_modes: string[]; vote_closer_roles: string[] }): boolean {
  return !!role && org.vote_close_modes.includes("chair") && org.vote_closer_roles.includes(role);
}

export interface VoteRecord {
  decision_rule?: string;
  quorum_required?: number;
  present_voting?: number;
  quorum_met?: boolean;
  seconder_required?: boolean;
  electorate?: string[];
  electorate_size?: number;
  not_voting?: string[];
  recused?: string[];
  present_not_linked?: string[];
  closed_how?: "chair" | "all_voted" | "timer";
  calculated?: boolean;
  needs_disposition_reason?: string | null;
}

export function parseVoteRecord(raw: unknown): VoteRecord | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as VoteRecord) : null;
}

export const CLOSED_HOW: Record<string, string> = { chair: "closed by the chair", all_voted: "closed automatically when everyone had voted", timer: "closed when the timer ran out" };

/** Live quorum: present (or remote) voting members against the org's required count. */
export function quorumStatus(list: Attendee[], required: number) {
  const present = rollCallVoters(list).length;
  return { present, required, met: present >= required, short: Math.max(0, required - present) };
}
