// The single role → capability table. The database policies mirror it:
// manage = can_manage_org, edit = can_edit_records. permissions.test.ts pins every cell.
export type OrgRole =
  "owner" | "admin" | "chair" | "secretary" | "treasurer" | "member" | "observer";

export type Capability =
  | "org.manage"
  | "members.invite"
  | "records.edit"
  | "minutes.approve"
  | "audit.read"
  | "export.run"
  | "ownership.transfer"
  | "records.read";

export const ROLES: OrgRole[] = [
  "owner",
  "admin",
  "chair",
  "secretary",
  "treasurer",
  "member",
  "observer",
];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  chair: "Chair",
  secretary: "Secretary",
  treasurer: "Treasurer",
  member: "Board member",
  observer: "Observer",
};

export const CAPABILITIES: Record<Capability, OrgRole[]> = {
  "org.manage": ["owner", "admin"],
  "members.invite": ["owner", "admin"],
  "records.edit": ["owner", "admin", "chair", "secretary"],
  "minutes.approve": ["owner", "admin", "chair", "secretary"],
  "audit.read": ["owner", "admin", "chair", "secretary"],
  "export.run": ["owner", "admin"],
  // The database's transfer_ownership() function also checks the caller is the owner.
  "ownership.transfer": ["owner"],
  "records.read": ["owner", "admin", "chair", "secretary", "treasurer", "member", "observer"],
};

/**
 * What still works while billing makes Board read-only (S-05): reading, the audit log, exports,
 * and ownership (a core action, not Board's records). The database refuses every other write.
 */
export const READ_ONLY_SAFE: readonly Capability[] = [
  "records.read",
  "audit.read",
  "export.run",
  "ownership.transfer",
];

/** `can()`, and off for writes while the organization's plan makes Board read-only. */
export function canNow(
  role: OrgRole | null | undefined,
  cap: Capability,
  readOnly: boolean,
): boolean {
  return can(role, cap) && (!readOnly || READ_ONLY_SAFE.includes(cap));
}

export function can(role: OrgRole | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[cap].includes(role);
}
