/** Meeting templates: a reusable meeting title, time, place and agenda outline. */
export interface TemplateAgendaItem {
  title: string;
  presenter?: string | null;
  duration_minutes?: number | null;
  description?: string | null;
}

export const STANDARD_AGENDA: TemplateAgendaItem[] = [
  { title: "Call to order" },
  { title: "Approval of previous minutes" },
  { title: "Treasurer's report" },
  { title: "Old business" },
  { title: "New business" },
  { title: "Adjournment" },
];

/** Cleans untrusted template agenda JSON: drops blank titles, trims text, keeps sane durations. */
export function normalizeAgenda(raw: unknown): TemplateAgendaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateAgendaItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const presenter = typeof o.presenter === "string" && o.presenter.trim() ? o.presenter.trim() : null;
    const d = Number(o.duration_minutes);
    const duration_minutes = Number.isInteger(d) && d > 0 && d <= 600 ? d : null;
    const description = typeof o.description === "string" && o.description.trim() ? o.description.trim() : null;
    out.push({ title, presenter, duration_minutes, description });
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
