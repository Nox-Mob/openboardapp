/** Meeting templates: a reusable meeting title, time, place and agenda outline. */
export interface TemplateAgendaItem {
  title: string;
  presenter?: string | null;
  duration_minutes?: number | null;
  description?: string | null;
  proposed_motion?: string | null;
  is_vote_item?: boolean;
  decision_rule?: string | null;
}

export const STANDARD_AGENDA: TemplateAgendaItem[] = [
  { title: "Call to order" },
  { title: "Approval of previous minutes" },
  { title: "Treasurer's report" },
  { title: "Old business" },
  { title: "New business" },
  { title: "Adjournment" },
];

const RULES = ["majority_cast", "majority_present", "two_thirds_cast", "chair"];

/** Cleans untrusted template agenda JSON: drops blank titles, trims text, keeps sane durations. */
export function normalizeAgenda(raw: unknown): TemplateAgendaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateAgendaItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as { title?: unknown; presenter?: unknown; duration_minutes?: unknown; description?: unknown; proposed_motion?: unknown; is_vote_item?: unknown; decision_rule?: unknown };
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const presenter = typeof o.presenter === "string" && o.presenter.trim() ? o.presenter.trim() : null;
    const d = Number(o.duration_minutes);
    const duration_minutes = Number.isInteger(d) && d > 0 && d <= 600 ? d : null;
    const description = typeof o.description === "string" && o.description.trim() ? o.description.trim() : null;
    const proposed_motion = typeof o.proposed_motion === "string" && o.proposed_motion.trim() ? o.proposed_motion.trim() : null;
    const is_vote_item = o.is_vote_item === true || !!proposed_motion;
    const decision_rule = is_vote_item && typeof o.decision_rule === "string" && RULES.includes(o.decision_rule) ? o.decision_rule : null;
    out.push({ title, presenter, duration_minutes, description, proposed_motion, is_vote_item, decision_rule });
  }
  return out;
}

/** Turns a template's agenda into rows for a new meeting, numbered in order. */
export function agendaRowsFor(items: TemplateAgendaItem[], meetingId: string, organizationId: string) {
  return normalizeAgenda(items).map((a, position) => ({
    ...a,
    position,
    meeting_id: meetingId,
    organization_id: organizationId,
  }));
}

/** Parses the one-item-per-line editor: "Title | Presenter | Minutes". */
export function parseAgendaText(text: string): TemplateAgendaItem[] {
  return normalizeAgenda(
    text.split("\n").map((line) => {
      const [title, presenter, minutes] = line.split("|").map((s) => s.trim());
      return { title, presenter, duration_minutes: minutes ? Number(minutes) : null };
    }),
  );
}

export function agendaToText(items: TemplateAgendaItem[]): string {
  return normalizeAgenda(items)
    .map((a) => [a.title, a.presenter ?? "", a.duration_minutes ?? ""].join(" | ").replace(/( \| )+$/, ""))
    .join("\n");
}

export function totalMinutes(items: TemplateAgendaItem[]): number {
  return normalizeAgenda(items).reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
}
