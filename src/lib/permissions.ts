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
  "records.read": ["owner", "admin", "chair", "secretary", "treasurer", "member", "observer"],
};

export function can(role: OrgRole | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[cap].includes(role);
}
