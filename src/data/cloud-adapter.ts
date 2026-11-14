import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgBilling } from "@shared/supabase/billing";
import { supabase } from "@/integrations/supabase/client";
import type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import type { OrgRole } from "@/lib/permissions";
import type { OrgSummary } from "@/lib/org-context";
import { normalizeAgenda, type TemplateAgendaItem } from "@/lib/templates";
import { documentPath } from "@/lib/documents";

type Status = Database["board"]["Enums"]["task_status"];
type MeetingStatus = Database["board"]["Enums"]["meeting_status"];
type CoreRole = Database["public"]["Enums"]["org_role"];
type Office = "chair" | "secretary" | "treasurer";
const OFFICES: readonly string[] = ["chair", "secretary", "treasurer"];

// Organizations, people, roles and invitations are core (schema public, SHARED-SPEC §4);
// Board adds its settings (board.org_settings, defaults when missing) and an office on
// top of a core role (board.officers). The app keeps its single role per person:
//   owner → owner, admin → admin, member + office → that office, member → member,
//   viewer → observer.
const core = () => supabase.schema("public");

export function boardRole(
  role: CoreRole | null | undefined,
  office: string | null | undefined,
): OrgRole | null {
  if (!role) return null;
  if (role === "owner" || role === "admin") return role;
  if (role === "viewer") return "observer";
  return office && OFFICES.includes(office) ? (office as Office) : "member";
}

/**
 * A person's role in Board (core 0010): the owner is the owner; otherwise the role an owner or
 * admin set for Board, or their OpenAppHub role.
 */
export function effectiveRole(core: CoreRole, override: CoreRole | null | undefined): CoreRole {
  return core === "owner" ? "owner" : (override ?? core);
}

type Override = { org_id: string; user_id: string; role: CoreRole };
/**
 * Each person's Board role as the database works it out (core 0011, H-09): the owner; a role
 * set for them in Board; their named role's role in Board; otherwise viewer. One person's
 * organizations (userIds = [me]) or everyone in one organization.
 */
async function boardOverrides(orgIds: string[], userIds?: string[]): Promise<Override[]> {
  if (orgIds.length === 0) return [];
  // The core functions aren't in the generated types until they're regenerated (H-06).
  const pub = supabase.schema("public") as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: Array<Record<string, string>> | null; error: unknown }>;
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          in: (k: string, v: string[]) => PromiseLike<{ data: Override[] | null; error: unknown }>;
        };
      };
    };
  };
  try {
    if (userIds?.length === 1) {
      const { data, error } = await pub.rpc("my_app_memberships", { p_app: "board" });
      if (!error && data)
        return data
          .filter((r) => orgIds.includes(r["org_id"]!))
          .map((r) => ({
            org_id: r["org_id"]!,
            user_id: userIds[0]!,
            role: r["role"] as CoreRole,
          }));
    } else {
      const all = await Promise.all(orgIds.map((org) => pub.rpc("org_app_roles", { p_org: org })));
      if (all.every((r) => !r.error && r.data))
        return all.flatMap((r, i) =>
          (r.data ?? [])
            .filter((x) => x["app"] === "board" && (!userIds || userIds.includes(x["user_id"]!)))
            .map((x) => ({
              org_id: orgIds[i]!,
              user_id: x["user_id"]!,
              role: x["role"] as CoreRole,
            })),
        );
    }
    // Older databases (before core 0011): roles set for Board, otherwise the OpenAppHub role.
    const { data, error } = await pub
      .from("app_role_overrides")
      .select("org_id, user_id, role")
      .eq("app", "board")
      .in("org_id", orgIds);
    return error ? [] : (data ?? []).filter((o) => !userIds || userIds.includes(o.user_id));
  } catch {
    return [];
  }
}

/**
 * A database function parameter that accepts null: the generated types (H-06) can only describe it
 * as required, so say here that null is meant.
 */
const orNull = <T>(v: T | null | undefined) => (v ?? null) as T;

/** The core role and office to store for a Board role. */
export function coreFor(role: OrgRole): {
  role: Exclude<CoreRole, "owner">;
  office: Office | null;
} {
  if (role === "admin") return { role: "admin", office: null };
  if (role === "observer") return { role: "viewer", office: null };
  if (OFFICES.includes(role)) return { role: "member", office: role as Office };
  return { role: "member", office: null };
}

/** board.org_settings column defaults (0001_board_baseline.sql). */
export const SETTINGS_DEFAULTS = {
  timezone: "America/Chicago",
  quorum_count: 1,
  vote_recording: "totals",
  vote_close_modes: ["chair"],
  vote_timer_minutes: null as number | null,
  vote_closer_roles: ["owner", "admin", "chair", "secretary"] as OrgRole[],
  seconder_required: true,
  decision_rule: "majority_cast",
};
const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof typeof SETTINGS_DEFAULTS)[];
const BUCKET = "board-files";

function must<R extends { data: unknown; error: unknown }>(r: R): NonNullable<R["data"]> {
  if (r.error) throw r.error;
  return r.data as NonNullable<R["data"]>;
}

/**
 * B-11: a file and its record can't share one database transaction, so the file goes up first
 * and, if writing its record fails, comes back out: nothing is left half-done.
 */
async function withUploadedFile<T>(
  path: string,
  upload: () => Promise<{ error: unknown }>,
  record: () => Promise<T>,
): Promise<T> {
  const up = await upload();
  if (up.error) {
    // The bucket refuses files over 50 MB (migration 0018); say so in plain words.
    const message = (up.error as { message?: string }).message ?? "";
    if (/maximum allowed size|too large|payload too large|413/i.test(message))
      throw new Error(
        "That file is larger than 50 MB, the most OpenBoardApp stores. Make it smaller (for example, save a PDF at a lower quality) and try again.",
      );
    throw up.error;
  }
  try {
    return await record();
  } catch (err) {
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(() => undefined);
    throw err;
  }
}

export const EXPORT_TABLES = [
  "organizations",
  "org_settings",
  "letterheads",
  "memberships",
  "officers",
  "people",
  "positions",
  "terms",
  "committees",
  "committee_members",
  "meetings",
  "agenda_items",
  "attendance",
  "motions",
  "minutes",
  "documents",
  "document_versions",
  "packets",
  "action_items",
  "meeting_templates",
  "audit_log",
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

/** Supabase implementation of the data layer. All reads/writes run under row-level security as the signed-in user. */
export const cloudAdapter = {
  platform: "supabase" as const,

  /** The signed-in user's client, for shared suite UI that calls core functions (shared/ui). */
  sharedClient(): SupabaseClient {
    return supabase as unknown as SupabaseClient;
  },

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
      const data = must(
        await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: fullName } },
        }),
      );
      return { needsConfirmation: !data.session };
    },
    /** Redirects the browser to Google; Supabase returns to `redirectUri`, where the session is picked up from the URL. */
    async signInWithGoogle(redirectUri: string) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUri },
      });
      return { error };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    /** The signed-in person's name and email, for the user menu. */
    async currentUser() {
      const { data } = await supabase.auth.getUser();
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      return {
        name: (meta["full_name"] as string | undefined) ?? null,
        email: data.user?.email ?? null,
      };
    },
  },

  /** The hub's billing state for the banner (core get_org_billing); null when billing is off. */
  billing: {
    async get(orgId: string) {
      return getOrgBilling(core() as unknown as SupabaseClient, orgId);
    },
  },

  orgs: {
    async listMine(userId: string) {
      const rows = (
        must(
          await core()
            .from("memberships")
            .select("role, organizations(id, name)")
            .eq("user_id", userId),
        ) ?? []
      ).filter((m) => m.organizations);
      const ids = rows.map((m) => m.organizations!.id);
      const overrides = await boardOverrides(ids, [userId]);
      const [settings, offices] = ids.length
        ? await Promise.all([
            supabase.from("org_settings").select("*").in("org_id", ids),
            supabase
              .from("officers")
              .select("org_id, office")
              .eq("user_id", userId)
              .in("org_id", ids),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];
      if (settings.error) throw settings.error;
      if (offices.error) throw offices.error;
      return rows
        .map((m) => {
          const org = m.organizations!;
          const s = (settings.data ?? []).find((x) => x.org_id === org.id);
          const picked = Object.fromEntries(
            SETTINGS_KEYS.map((k) => [k, s ? s[k] : SETTINGS_DEFAULTS[k]]),
          ) as typeof SETTINGS_DEFAULTS;
          return {
            ...picked,
            id: org.id,
            name: org.name,
            role: boardRole(
              effectiveRole(m.role, overrides.find((o) => o.org_id === org.id)?.role),
              (offices.data ?? []).find((o) => o.org_id === org.id)?.office,
            )!,
          } satisfies OrgSummary;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    /** Core creates the organization (the caller is its owner); Board keeps its time zone. */
    async create(name: string, timezone: string) {
      const id = must(await core().rpc("create_organization", { p_name: name })) as string;
      must(await supabase.from("org_settings").insert({ org_id: id, timezone }));
      return id;
    },
    /** Name is core's (rename_organization); everything else is Board's settings. */
    async update(orgId: string, patch: Partial<Omit<OrgSummary, "id" | "role">>) {
      const { name, ...rest } = patch;
      if (name !== undefined) {
        const current = must(
          await core().from("organizations").select("name").eq("id", orgId).single(),
        );
        if (current.name !== name)
          must(await core().rpc("rename_organization", { p_org: orgId, p_name: name }));
      }
      const settings = Object.fromEntries(
        Object.entries(rest).filter(([k]) => (SETTINGS_KEYS as string[]).includes(k)),
      );
      if (Object.keys(settings).length)
        must(
          await supabase
            .from("org_settings")
            .upsert({ org_id: orgId, ...settings }, { onConflict: "org_id" }),
        );
    },
    /** Active members the owner may hand ownership to, each with the exact text to type. Owner only. */
    async transferCandidates(orgId: string) {
      const rows = must(await core().rpc("ownership_transfer_candidates", { p_org: orgId })) ?? [];
      return rows.map((c) => ({
        user_id: c.user_id,
        full_name: c.display_name,
        email: c.email,
        role: boardRole(c.role, null) as OrgRole,
        confirm_text: c.display_name || c.email,
      }));
    },
    /** Makes newOwnerId the owner and the caller an administrator. The database re-checks everything. */
    async transferOwnership(orgId: string, newOwnerId: string, _confirmation: string) {
      must(await core().rpc("transfer_ownership", { p_org: orgId, p_new_owner: newOwnerId }));
    },
    async exportAll(orgId: string) {
      const out: Record<string, Record<string, unknown>[]> = {};
      for (const t of EXPORT_TABLES) {
        const coreTable = t === "organizations" || t === "memberships";
        const col = t === "organizations" ? "id" : "org_id";
        const client = coreTable ? (core() as unknown as typeof supabase) : supabase;
        const data = must(
          await client
            .from(t as "meetings")
            .select("*")
            .eq(col as "org_id", orgId),
        );
        out[t] = (data ?? []) as Record<string, unknown>[];
      }
      return out;
    },
  },

  letterhead: {
    async get(orgId: string) {
      const r = await supabase.from("letterheads").select("*").eq("org_id", orgId).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
    async save(row: TablesInsert<"letterheads">, file?: Blob) {
      const write = async () =>
        void must(
          await supabase
            .from("letterheads")
            .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "org_id" }),
        );
      if (!file) return write();
      await withUploadedFile(
        row.storage_path,
        () =>
          supabase.storage
            .from(BUCKET)
            .upload(row.storage_path, file, { contentType: row.mime_type, upsert: false }),
        write,
      );
    },
    async remove(orgId: string) {
      must(await supabase.from("letterheads").delete().eq("org_id", orgId));
    },
  },

  members: {
    async list(orgId: string) {
      const [dir, offices, overrides] = await Promise.all([
        core().rpc("org_member_directory", { p_org: orgId }),
        supabase.from("officers").select("user_id, office").eq("org_id", orgId),
        boardOverrides([orgId]),
      ]);
      if (dir.error) throw dir.error;
      return (dir.data ?? []).map((m) => ({
        id: m.user_id,
        user_id: m.user_id,
        org_id: orgId,
        role: boardRole(
          effectiveRole(m.role, overrides.find((o) => o.user_id === m.user_id)?.role),
          (offices.data ?? []).find((o) => o.user_id === m.user_id)?.office,
        )!,
        name: m.display_name || m.email || "Member",
        email: m.email ?? "",
      }));
    },
    /**
     * The Board role first (core 0010: only in Board; their role in OpenAppHub and the other apps
     * stays as it is; owners and admins only), then the office, which needs a member role.
     */
    async setRole(orgId: string, userId: string, role: OrgRole) {
      if (role === "owner") throw new Error("Use Transfer ownership to make someone the owner.");
      const next = coreFor(role);
      const rpc = core().rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const { error } = await rpc("set_app_role", {
        p_org: orgId,
        p_user: userId,
        p_app: "board",
        p_role: next.role,
      });
      if (error) throw new Error(error.message);
      if (next.office)
        must(
          await supabase
            .from("officers")
            .upsert(
              { org_id: orgId, user_id: userId, office: next.office },
              { onConflict: "org_id,user_id" },
            ),
        );
      else must(await supabase.from("officers").delete().eq("org_id", orgId).eq("user_id", userId));
    },
    async remove(orgId: string, userId: string) {
      must(await supabase.from("officers").delete().eq("org_id", orgId).eq("user_id", userId));
      must(await core().from("memberships").delete().eq("org_id", orgId).eq("user_id", userId));
    },
  },

  invitations: {
    async listOpen(orgId: string) {
      const rows =
        must(
          await core()
            .from("invitations")
            .select("id, email, role, app, app_payload, expires_at, created_at")
            .eq("org_id", orgId)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .order("created_at", { ascending: false }),
        ) ?? [];
      return rows.map((r) => {
        const office = (r.app_payload as { office?: string } | null)?.office;
        return { ...r, role: boardRole(r.role, r.app === "board" ? office : null) ?? "member" };
      });
    },
    /**
     * A core invitation for this email (H-09): an OpenAppHub member with this role in Board only;
     * an office rides along for Board to apply. Returns the token.
     */
    async create(orgId: string, email: string, role: OrgRole) {
      const next = coreFor(role);
      const invite = async (hubRole: string) => {
        const rows = must(
          await core().rpc("create_invitation", {
            p_org: orgId,
            p_email: email,
            p_role: hubRole as CoreRole,
            p_app: "board",
            p_payload: next.office ? { office: next.office } : {},
          }),
        );
        return (Array.isArray(rows) ? rows[0] : rows) as { invitation_id: string; token: string };
      };
      const row = await invite("member");
      // set_invitation_roles isn't in the generated types until they're regenerated (H-06).
      const rpc = core().rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ error: { code?: string; message: string } | null }>;
      const { error } = await rpc.call(core(), "set_invitation_roles", {
        p_invitation: row.invitation_id,
        p_named_role: null,
        p_app_roles: { board: next.role },
      });
      if (!error) return row.token;
      // A database before core 0011: the role was the OpenAppHub role then.
      if (error.code === "PGRST202" || /set_invitation_roles/.test(error.message)) {
        must(await core().rpc("revoke_invitation", { p_id: row.invitation_id }));
        return (await invite(next.role)).token;
      }
      throw new Error(error.message);
    },
    async revoke(id: string) {
      must(await core().rpc("revoke_invitation", { p_id: id }));
    },
    /** Core accepts it (once, for this account); then Board applies the office. Returns the org id. */
    async accept(token: string) {
      const rows = must(await core().rpc("accept_invitation", { p_token: token }));
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error("This invitation link isn't valid.");
      if (row.app === "board")
        must(await supabase.rpc("on_invitation_accepted", { p_invitation_id: row.id }));
      return row.org_id as string;
    },
  },

  terms: {
    async list(orgId: string) {
      return (
        must(
          await supabase
            .from("terms")
            .select("*")
            .eq("org_id", orgId)
            .order("start_date", { ascending: false }),
        ) ?? []
      );
    },
    async add(row: TablesInsert<"terms">) {
      must(await supabase.from("terms").insert(row));
    },
    /**
     * Hands a role to a new holder: open terms for that role end the day before, history is kept.
     * One database call (board.assign_term, B-11), so the old term never ends without the new one.
     */
    async assign(row: TablesInsert<"terms"> & { position_id: string }) {
      must(
        await supabase.rpc("assign_term", {
          p_org: row.org_id,
          p_position_id: row.position_id,
          p_position: row.position ?? "",
          p_person_name: row.person_name,
          p_user_id: orNull(row.user_id),
          p_start_date: row.start_date,
          p_end_date: orNull(row.end_date),
        }),
      );
    },
    async remove(id: string) {
      must(await supabase.from("terms").delete().eq("id", id));
    },
  },

  positions: {
    async list(orgId: string) {
      return (
        must(
          await supabase
            .from("positions")
            .select("*")
            .eq("org_id", orgId)
            .order("sort_order")
            .order("title"),
        ) ?? []
      );
    },
    async add(row: TablesInsert<"positions">) {
      must(await supabase.from("positions").insert(row));
    },
    async update(id: string, patch: { title?: string; term_years?: number | null }) {
      must(await supabase.from("positions").update(patch).eq("id", id));
    },
    async remove(id: string) {
      must(await supabase.from("positions").delete().eq("id", id));
    },
  },

  committees: {
    async list(orgId: string) {
      return (
        must(
          await supabase
            .from("committees")
            .select("*, committee_members(*)")
            .eq("org_id", orgId)
            .order("name"),
        ) ?? []
      );
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
      return (
        must(
          await supabase
            .from("meetings")
            .select("*")
            .eq("org_id", orgId)
            .order("meeting_date", { ascending: false }),
        ) ?? []
      );
    },
    async get(id: string) {
      const r = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
    /**
     * Creates a meeting and its starting agenda (from a template, or the standard outline) in one
     * database call (board.create_meeting_with_agenda, B-11): never a meeting without its agenda.
     */
    async create(row: TablesInsert<"meetings">, agenda: TemplateAgendaItem[]) {
      return must(
        await supabase.rpc("create_meeting_with_agenda", {
          p_org: row.org_id,
          p_title: row.title,
          p_meeting_date: row.meeting_date,
          p_start_time: orNull(row.start_time),
          p_location: orNull(row.location),
          p_agenda: normalizeAgenda(agenda) as unknown as Json,
        }),
      );
    },
    async setStatus(id: string, status: MeetingStatus) {
      must(await supabase.from("meetings").update({ status }).eq("id", id));
    },
  },

  agenda: {
    async list(meetingId: string) {
      return (
        must(
          await supabase
            .from("agenda_items")
            .select("*")
            .eq("meeting_id", meetingId)
            .order("position"),
        ) ?? []
      );
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
      return (
        must(
          await supabase
            .from("attendance")
            .select("*")
            .eq("meeting_id", meetingId)
            .order("person_name"),
        ) ?? []
      );
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
      return (
        must(
          await supabase
            .from("motions")
            .select("*")
            .eq("meeting_id", meetingId)
            .order("created_at"),
        ) ?? []
      );
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
      return (
        must(
          await supabase
            .from("minutes")
            .select("*")
            .eq("meeting_id", meetingId)
            .order("version", { ascending: false }),
        ) ?? []
      );
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
      return (
        must(
          await supabase
            .from("documents")
            .select("*, document_versions(*), meetings(title, meeting_date)")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false }),
        ) ?? []
      );
    },
    /**
     * A new document with its first file (B-11): the file goes up, then the document and its
     * version are written in one call (board.add_document); if that fails, the file is removed.
     */
    async createWithFile(
      row: { org_id: string; title: string; category: string; meeting_id: string | null },
      file: File,
    ) {
      const id = crypto.randomUUID();
      const path = documentPath(row.org_id, id, 1, file.name);
      return withUploadedFile(
        path,
        () =>
          supabase.storage
            .from(BUCKET)
            .upload(path, file, file.type ? { contentType: file.type } : {}),
        async () =>
          must(
            await supabase.rpc("add_document", {
              p_id: id,
              p_org: row.org_id,
              p_title: row.title,
              p_category: row.category,
              p_meeting_id: orNull(row.meeting_id),
              p_storage_path: path,
              p_file_name: file.name,
              p_mime_type: file.type,
              p_size_bytes: file.size,
            }),
          ),
      );
    },
    async addVersion(row: TablesInsert<"document_versions">, file: Blob, contentType?: string) {
      await withUploadedFile(
        row.storage_path,
        () =>
          supabase.storage
            .from(BUCKET)
            .upload(row.storage_path, file, contentType ? { contentType } : {}),
        async () => void must(await supabase.from("document_versions").insert(row)),
      );
    },
  },

  packets: {
    async list(meetingId: string) {
      return (
        must(
          await supabase
            .from("packets")
            .select("*")
            .eq("meeting_id", meetingId)
            .order("version", { ascending: false }),
        ) ?? []
      );
    },
    async create(row: TablesInsert<"packets">, pdf: Blob) {
      await withUploadedFile(
        row.storage_path,
        () => supabase.storage.from(BUCKET).upload(row.storage_path, pdf, { upsert: false }),
        async () => void must(await supabase.from("packets").insert(row)),
      );
    },
    async distribute(id: string) {
      must(
        await supabase
          .from("packets")
          .update({ distributed_at: new Date().toISOString() })
          .eq("id", id),
      );
    },
  },

  files: {
    async signedUrl(path: string) {
      return must(await supabase.storage.from(BUCKET).createSignedUrl(path, 60)).signedUrl;
    },
    /** Downloads a private file's bytes (null when it can't be read). */
    async download(path: string): Promise<ArrayBuffer | null> {
      const r = await supabase.storage.from(BUCKET).download(path);
      return r.error || !r.data ? null : await r.data.arrayBuffer();
    },
  },

  records: {
    /** Everything the board record export needs for meetings dated in [from, to]. */
    async forRange(orgId: string, from: string, to: string) {
      const meetings =
        must(
          await supabase
            .from("meetings")
            .select("*, attendance(*), motions(*), minutes(*), packets(*), agenda_items(*)")
            .eq("org_id", orgId)
            .gte("meeting_date", from)
            .lte("meeting_date", to)
            .order("meeting_date"),
        ) ?? [];
      const documents =
        must(
          await supabase
            .from("documents")
            .select("*, document_versions(*)")
            .eq("org_id", orgId)
            .not("meeting_id", "is", null),
        ) ?? [];
      return { meetings, documents };
    },
  },

  actions: {
    async list(
      orgId: string,
      opts: { meetingId?: string | undefined; assigneeId?: string | undefined } = {},
    ) {
      let q = supabase
        .from("action_items")
        .select("*, meetings(title, meeting_date)")
        .eq("org_id", orgId);
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
        supabase
          .from("meetings")
          .select("*")
          .eq("org_id", orgId)
          .gte("meeting_date", today)
          .neq("status", "archived")
          .order("meeting_date")
          .limit(3),
        supabase
          .from("action_items")
          .select("*")
          .eq("org_id", orgId)
          .eq("assignee_id", userId)
          .in("status", ["open", "in_progress"])
          .order("due_date"),
        supabase
          .from("minutes")
          .select("id, version, meeting_id, meetings(title, meeting_date)")
          .eq("org_id", orgId)
          .eq("status", "submitted"),
      ]);
      return {
        meetings: must(meetings) ?? [],
        tasks: must(tasks) ?? [],
        minutes: must(minutes) ?? [],
      };
    },
  },

  audit: {
    async list(orgId: string) {
      return (
        must(
          await supabase
            .from("audit_log")
            .select("*")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(300),
        ) ?? []
      );
    },
  },

  voting: {
    /** Opens a live vote (creates the motion and freezes the electorate) in one database transaction. */
    async start(
      meetingId: string,
      v: {
        agenda_item_id: string | null;
        motion_text: string;
        moved_by: string | null;
        seconded_by: string | null;
      },
    ) {
      return must(
        await supabase.rpc("start_vote", {
          p_meeting: meetingId,
          p_agenda_item: v.agenda_item_id as string,
          p_text: v.motion_text,
          p_moved_by: v.moved_by as string,
          p_seconded_by: v.seconded_by as string,
        }),
      ) as string;
    },
    async cast(motionId: string, vote: "yes" | "no" | "abstain" | "recused") {
      return must(await supabase.rpc("cast_vote", { p_motion: motionId, p_vote: vote })) as
        "recorded" | "expired";
    },
    async close(motionId: string) {
      const r = await supabase.rpc("close_vote", { p_motion: motionId });
      if (r.error) throw r.error;
    },
    async recordDisposition(
      motionId: string,
      outcome: Database["board"]["Enums"]["motion_outcome"],
      note: string,
    ) {
      const r = await supabase.rpc("record_disposition", {
        p_motion: motionId,
        p_outcome: outcome,
        p_note: note,
      });
      if (r.error) throw r.error;
    },
    async progress(motionId: string) {
      return must(await supabase.rpc("vote_progress", { p_motion: motionId })) as {
        cast: number;
        electorate: number;
      };
    },
    async electorate(motionId: string) {
      return (
        must(
          await supabase
            .from("vote_electorate")
            .select("*")
            .eq("motion_id", motionId)
            .order("person_name"),
        ) ?? []
      );
    },
    /** Returns the caller's own vote before close (RLS), or every vote after close. */
    async votes(motionId: string) {
      return (
        must(
          await supabase
            .from("member_votes")
            .select("*")
            .eq("motion_id", motionId)
            .order("person_name"),
        ) ?? []
      );
    },
  },

  templates: {
    async list(orgId: string) {
      const rows =
        must(
          await supabase.from("meeting_templates").select("*").eq("org_id", orgId).order("name"),
        ) ?? [];
      return rows.map((t) => ({ ...t, agenda: normalizeAgenda(t.agenda) }));
    },
    async save(
      row: Omit<TablesInsert<"meeting_templates">, "agenda"> & {
        agenda: TemplateAgendaItem[];
        id?: string;
      },
    ) {
      const payload = {
        ...row,
        agenda: normalizeAgenda(row.agenda) as unknown as Tables<"meeting_templates">["agenda"],
      };
      if (row.id) {
        const { id, org_id: _o, created_by: _c, ...patch } = payload;
        must(await supabase.from("meeting_templates").update(patch).eq("id", id!));
        return id!;
      }
      return must(await supabase.from("meeting_templates").insert(payload).select("id").single())
        .id;
    },
    async remove(id: string) {
      must(await supabase.from("meeting_templates").delete().eq("id", id));
    },
  },
};

export type DataLayer = typeof cloudAdapter;
