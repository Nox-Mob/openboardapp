// Ownership-transfer confirmation. Mirrors the check in the database's
// transfer_ownership() function (trimmed, case-insensitive), which stays the
// authority: this only decides when the dialog's button becomes clickable.
export function confirmationMatches(typed: string, expected: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(expected).length > 0 && norm(typed) === norm(expected);
}
