import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { OrgRole } from "@/lib/permissions";
import { agendaRowsFor, normalizeAgenda, type TemplateAgendaItem } from "@/lib/templates";

type Status = Database["public"]["Enums"]["task_status"];
type MeetingStatus = Database["public"]["Enums"]["meeting_status"];
const BUCKET = "org-files";

function must<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

export const EXPORT_TABLES = ["organizations", "memberships", "board_terms", "committees", "committee_members", "meetings", "agenda_items", "attendance", "motions", "minutes", "documents", "document_versions", "packets", "action_items", "meeting_templates", "audit_log"] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

/** Lovable Cloud implementation of the data layer. All reads/writes run under row-level security as the signed-in user. */
export const cloudAdapter = {
  platform: "lovable-cloud" as const,

  auth: {
    async hasSession() {
      return !!(await supabase.auth.getSession()).data.session;
    },
    onChange(cb: (event: string, signedIn: boolean) => void) {
      const { data } = supabase.auth.onAuthStateChange((e, s) => cb(e, !!s));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email: string, password: string) {
      must(await supabase.auth.signInWithPassword({ email, password }));
    },
    async signUp(email: string, password: string, fullName: string, redirectTo: string) {
      const data = must(await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { full_name: fullName } } }));
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle(redirectUri: string) {
      return lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUri });
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  },

  orgs: {
    async listMine(userId: string) {
      const data = must(await supabase.from("memberships").select("role, organizations(id, name, timezone, quorum_count)").eq("user_id", userId));
      return (data ?? [])
        .filter((m) => m.organizations)
        .map((m) => ({ ...(m.organizations as { id: string; name: string; timezone: string; quorum_count: number }), role: m.role as OrgRole }));
    },
    async create(name: string, timezone: string) {
      return must(await supabase.rpc("create_organization", { _name: name, _timezone: timezone })) as string;
    },
    async update(orgId: string, patch: TablesUpdate<"organizations">) {
      must(await supabase.from("organizations").update(patch).eq("id", orgId));
    },
    async exportAll(orgId: string) {
      const out: Record<string, Record<string, unknown>[]> = {};
      for (const t of EXPORT_TABLES) {
        const col = t === "organizations" ? "id" : "organization_id";
        const data = must(await supabase.from(t).select("*").eq(col as "id", orgId));
        out[t] = (data ?? []) as Record<string, unknown>[];
      }
      return out;
    },
  },

  members: {
    async list(orgId: string) {
      const ms = must(await supabase.from("memberships").select("id, user_id, role").eq("organization_id", orgId)) ?? [];
      const ids = ms.map((m) => m.user_id);
      const ps = ids.length ? must(await supabase.from("profiles").select("id, full_name, email").in("id", ids)) ?? [] : [];
      return ms.map((m) => {
        const p = ps.find((x) => x.id === m.user_id);
        return { ...m, role: m.role as OrgRole, name: p?.full_name || p?.email || "Member", email: p?.email ?? "" };
      });
    },
    async setRole(membershipId: string, role: OrgRole) {
      must(await supabase.from("memberships").update({ role }).eq("id", membershipId));
    },
    async remove(membershipId: string) {
      must(await supabase.from("memberships").delete().eq("id", membershipId));
    },
  },

  invitations: {
    async listOpen(orgId: string) {
      return must(await supabase.from("invitations").select("*").eq("organization_id", orgId).is("accepted_at", null).order("created_at", { ascending: false })) ?? [];
    },
    async create(orgId: string, email: string, role: OrgRole) {
      return must(await supabase.rpc("create_invitation", { _org: orgId, _email: email, _role: role })) as string;
    },
    async revoke(id: string) {
      must(await supabase.from("invitations").delete().eq("id", id));
    },
    async accept(token: string) {
      return must(await supabase.rpc("accept_invitation", { _token: token })) as string;
    },
  },

  terms: {
    async list(orgId: string) {
      return must(await supabase.from("board_terms").select("*").eq("organization_id", orgId).order("start_date", { ascending: false })) ?? [];
    },
    async add(row: TablesInsert<"board_terms">) {
      must(await supabase.from("board_terms").insert(row));
    },
    async remove(id: string) {
      must(await supabase.from("board_terms").delete().eq("id", id));
    },
  },

  committees: {
    async list(orgId: string) {
      return must(await supabase.from("committees").select("*, committee_members(*)").eq("organization_id", orgId).order("name")) ?? [];
    },
    async add(row: TablesInsert<"committees">) {
      must(await supabase.from("committees").insert(row));
    },
    async addMember(row: TablesInsert<"committee_members">) {
      must(await supabase.from("committee_members").insert(row));
    },
    async remove(table: "committees" | "committee_members", id: string) {
      must(await supabase.from(table).delete().eq("id", id));
    },
  },

  meetings: {
    async list(orgId: string) {
      return must(await supabase.from("meetings").select("*").eq("organization_id", orgId).order("meeting_date", { ascending: false })) ?? [];
    },
    async get(id: string) {
      return must(await supabase.from("meetings").select("*").eq("id", id).maybeSingle());
    },
    /** Creates a meeting and its starting agenda (from a template, or the standard outline). */
    async create(row: TablesInsert<"meetings">, agenda: TemplateAgendaItem[]) {
      const m = must(await supabase.from("meetings").insert(row).select("id").single());
      const rows = agendaRowsFor(agenda, m.id, row.organization_id);
      if (rows.length) must(await supabase.from("agenda_items").insert(rows));
      return m.id;
    },
    async setStatus(id: string, status: MeetingStatus) {
      must(await supabase.from("meetings").update({ status }).eq("id", id));
    },
  },

  agenda: {
    async list(meetingId: string) {
      return must(await supabase.from("agenda_items").select("*").eq("meeting_id", meetingId).order("position")) ?? [];
    },
    async add(row: TablesInsert<"agenda_items">) {
      must(await supabase.from("agenda_items").insert(row));
    },
    async update(id: string, patch: TablesUpdate<"agenda_items">) {
      must(await supabase.from("agenda_items").update(patch).eq("id", id));
    },
    async remove(id: string) {
      must(await supabase.from("agenda_items").delete().eq("id", id));
    },
  },

  attendance: {
    async list(meetingId: string) {
      return must(await supabase.from("attendance").select("*").eq("meeting_id", meetingId).order("person_name")) ?? [];
    },
    async add(rows: TablesInsert<"attendance"> | TablesInsert<"attendance">[]) {
      must(await supabase.from("attendance").insert(rows));
    },
    async update(id: string, patch: TablesUpdate<"attendance">) {
      must(await supabase.from("attendance").update(patch).eq("id", id));
    },
    async remove(id: string) {
      must(await supabase.from("attendance").delete().eq("id", id));
    },
  },

  motions: {
    async list(meetingId: string) {
      return must(await supabase.from("motions").select("*").eq("meeting_id", meetingId).order("created_at")) ?? [];
    },
    async add(row: TablesInsert<"motions">) {
      must(await supabase.from("motions").insert(row));
    },
    async remove(id: string) {
      must(await supabase.from("motions").delete().eq("id", id));
    },
  },

  minutes: {
    async list(meetingId: string) {
      return must(await supabase.from("minutes").select("*").eq("meeting_id", meetingId).order("version", { ascending: false })) ?? [];
    },
    async create(row: TablesInsert<"minutes">) {
      return must(await supabase.from("minutes").insert(row).select("id").single()).id;
    },
    async update(id: string, patch: TablesUpdate<"minutes">) {
      must(await supabase.from("minutes").update(patch).eq("id", id));
    },
  },

  documents: {
    async list(orgId: string) {
      return must(await supabase.from("documents").select("*, document_versions(*), meetings(title, meeting_date)").eq("organization_id", orgId).order("created_at", { ascending: false })) ?? [];
    },
    async create(row: TablesInsert<"documents">) {
      return must(await supabase.from("documents").insert(row).select("id").single()).id;
    },
    async addVersion(row: TablesInsert<"document_versions">, file: Blob, contentType?: string) {
      must(await supabase.storage.from(BUCKET).upload(row.storage_path, file, contentType ? { contentType } : {}));
      must(await supabase.from("document_versions").insert(row));
    },
  },

  packets: {
    async list(meetingId: string) {
      return must(await supabase.from("packets").select("*").eq("meeting_id", meetingId).order("version", { ascending: false })) ?? [];
    },
    async create(row: TablesInsert<"packets">, pdf: Blob) {
      must(await supabase.storage.from(BUCKET).upload(row.storage_path, pdf, { upsert: false }));
      must(await supabase.from("packets").insert(row));
    },
    async distribute(id: string) {
      must(await supabase.from("packets").update({ distributed_at: new Date().toISOString() }).eq("id", id));
    },
  },

  files: {
    async signedUrl(path: string) {
      return must(await supabase.storage.from(BUCKET).createSignedUrl(path, 60)).signedUrl;
    },
  },

  actions: {
    async list(orgId: string, opts: { meetingId?: string; assigneeId?: string } = {}) {
      let q = supabase.from("action_items").select("*, meetings(title, meeting_date)").eq("organization_id", orgId);
      if (opts.meetingId) q = q.eq("meeting_id", opts.meetingId);
      if (opts.assigneeId) q = q.eq("assignee_id", opts.assigneeId);
      return must(await q.order("due_date", { nullsFirst: false })) ?? [];
    },
    async add(row: TablesInsert<"action_items">) {
      must(await supabase.from("action_items").insert(row));
    },
    async setStatus(id: string, status: Status) {
      must(await supabase.from("action_items").update({ status }).eq("id", id));
    },
  },

  overview: {
    async load(orgId: string, userId: string, today: string) {
      const [meetings, tasks, minutes] = await Promise.all([
        supabase.from("meetings").select("*").eq("organization_id", orgId).gte("meeting_date", today).neq("status", "archived").order("meeting_date").limit(3),
        supabase.from("action_items").select("*").eq("organization_id", orgId).eq("assignee_id", userId).in("status", ["open", "in_progress"]).order("due_date"),
        supabase.from("minutes").select("id, version, meeting_id, meetings(title, meeting_date)").eq("organization_id", orgId).eq("status", "submitted"),
      ]);
      return { meetings: must(meetings) ?? [], tasks: must(tasks) ?? [], minutes: must(minutes) ?? [] };
    },
  },

  audit: {
    async list(orgId: string) {
      return must(await supabase.from("audit_log").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(300)) ?? [];
    },
  },

  templates: {
    async list(orgId: string) {
      const rows = must(await supabase.from("meeting_templates").select("*").eq("organization_id", orgId).order("name")) ?? [];
      return rows.map((t) => ({ ...t, agenda: normalizeAgenda(t.agenda) }));
    },
    async save(row: Omit<TablesInsert<"meeting_templates">, "agenda"> & { agenda: TemplateAgendaItem[]; id?: string }) {
      const payload = { ...row, agenda: normalizeAgenda(row.agenda) as unknown as Tables<"meeting_templates">["agenda"] };
      if (row.id) {
        const { id, organization_id: _o, created_by: _c, ...patch } = payload;
        must(await supabase.from("meeting_templates").update(patch).eq("id", id!));
        return id!;
      }
      return must(await supabase.from("meeting_templates").insert(payload).select("id").single()).id;
    },
    async remove(id: string) {
      must(await supabase.from("meeting_templates").delete().eq("id", id));
    },
  },
};

export type DataLayer = typeof cloudAdapter;
