/** Board roles (positions) and who currently fills them. Pure helpers. */
export interface TermLike { id: string; position_id: string | null; position: string; person_name: string; user_id: string | null; start_date: string; end_date: string | null }

/** A term is current when it has started and has not ended before today. */
export function isCurrent(t: TermLike, today: string) {
  return t.start_date <= today && (!t.end_date || t.end_date >= today);
}

/** The latest-starting current term for a role, or null if vacant. */
export function currentHolder<T extends TermLike>(terms: T[], positionId: string, today: string): T | null {
  return terms.filter((t) => t.position_id === positionId && isCurrent(t, today)).sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;
}

/** End date of a term that starts on `start` and lasts `years` (null = open-ended). */
export function termEnd(start: string, years: number | null): string | null {
  if (!years) return null;
  const [y = 0, m = 1, d = 1] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y + years, m - 1, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

/** Current titles keyed by account id and by name (for people without an account). */
export function titleIndex(terms: TermLike[], today: string) {
  const byUser = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const t of terms.filter((x) => isCurrent(x, today))) {
    const add = (m: Map<string, string>, k: string) => m.set(k, m.has(k) ? `${m.get(k)}, ${t.position}` : t.position);
    if (t.user_id) add(byUser, t.user_id);
    else add(byName, t.person_name.trim().toLowerCase());
  }
  return {
    title: (userId?: string | null, name?: string | null) =>
      (userId && byUser.get(userId)) || (name ? byName.get(name.trim().toLowerCase()) : undefined) || null,
  };
}

export function withTitle(name: string, title: string | null) {
  return title ? `${name} — ${title}` : name;
}
