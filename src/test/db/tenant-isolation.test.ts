// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, ORG_B, DEMO_ORG, tag, type Client } from "./helpers";

// Release blocker: a user from Organization B must never read or change Organization A's records.
describe.skipIf(!hasDb)("tenant isolation (live database)", () => {
  let a: Client, b: Client;
  let meetingId: string, agendaId: string, motionId: string, minutesId: string, taskId: string, docId: string, filePath: string;

  beforeAll(async () => {
    a = await signIn("ownerA");
    b = await signIn("ownerB");
    const m = await a.from("meetings").insert({ organization_id: ORG_A, title: tag(), meeting_date: "2026-12-01" }).select("id").single();
    if (m.error) throw m.error;
    meetingId = m.data.id;
    agendaId = (await a.from("agenda_items").insert({ organization_id: ORG_A, meeting_id: meetingId, title: "Secret item", notes: "confidential" }).select("id").single()).data!.id;
    motionId = (await a.from("motions").insert({ organization_id: ORG_A, meeting_id: meetingId, motion_text: "Secret motion" }).select("id").single()).data!.id;
    minutesId = (await a.from("minutes").insert({ organization_id: ORG_A, meeting_id: meetingId, version: 1, content: "secret" }).select("id").single()).data!.id;
    taskId = (await a.from("action_items").insert({ organization_id: ORG_A, meeting_id: meetingId, title: "Secret task" }).select("id").single()).data!.id;
    docId = (await a.from("documents").insert({ organization_id: ORG_A, title: "Secret doc" }).select("id").single()).data!.id;
    filePath = `${ORG_A}/documents/${docId}/v1-${tag()}.txt`;
    const up = await a.storage.from("org-files").upload(filePath, new Blob(["top secret"], { type: "text/plain" }));
    if (up.error) throw up.error;
    await a.from("document_versions").insert({ organization_id: ORG_A, document_id: docId, version: 1, storage_path: filePath, file_name: "secret.txt" });
  });

  const tables = ["meetings", "agenda_items", "attendance", "motions", "minutes", "documents", "document_versions", "packets", "action_items", "board_terms", "committees", "committee_members", "invitations"] as const;
  for (const t of tables) {
    it(`B cannot list A's ${t}`, async () => {
      const { data } = await b.from(t).select("id").eq("organization_id", ORG_A);
      expect(data ?? []).toHaveLength(0);
    });
  }

  it("B cannot read A's meeting by guessing its id", async () => {
    const { data } = await b.from("meetings").select("*").eq("id", meetingId).maybeSingle();
    expect(data).toBeNull();
  });
  it("B cannot read A's notes by agenda item id", async () => {
    const { data } = await b.from("agenda_items").select("notes").eq("id", agendaId).maybeSingle();
    expect(data).toBeNull();
  });
  it("B cannot see A's organization, members or audit log", async () => {
    expect((await b.from("organizations").select("id").eq("id", ORG_A)).data).toHaveLength(0);
    expect((await b.from("memberships").select("id").eq("organization_id", ORG_A)).data).toHaveLength(0);
    expect((await b.from("audit_log").select("id").eq("organization_id", ORG_A)).data).toHaveLength(0);
  });
  it("B cannot see the demo organization either", async () => {
    expect((await b.from("meetings").select("id").eq("organization_id", DEMO_ORG)).data).toHaveLength(0);
  });
  it("B cannot create a meeting inside A", async () => {
    const { error } = await b.from("meetings").insert({ organization_id: ORG_A, title: "intrusion", meeting_date: "2026-12-01" });
    expect(error).not.toBeNull();
  });
  it("B cannot change or delete A's records", async () => {
    const up = await b.from("meetings").update({ title: "hacked" }).eq("id", meetingId).select("id");
    expect(up.data ?? []).toHaveLength(0);
    const motion = await b.from("motions").update({ outcome: "failed" }).eq("id", motionId).select("id");
    expect(motion.data ?? []).toHaveLength(0);
    const min = await b.from("minutes").update({ content: "forged" }).eq("id", minutesId).select("id");
    expect(min.data ?? []).toHaveLength(0);
    const del = await b.from("action_items").delete().eq("id", taskId).select("id");
    expect(del.data ?? []).toHaveLength(0);
    const still = await a.from("meetings").select("title").eq("id", meetingId).single();
    expect(still.data?.title).not.toBe("hacked");
  });
  it("B cannot attach its own rows to A's meeting", async () => {
    const { error } = await b.from("agenda_items").insert({ organization_id: ORG_B, meeting_id: meetingId, title: "smuggled" });
    expect(error?.message).toMatch(/another organization/i);
  });
  it("B cannot download A's files", async () => {
    const { error } = await b.storage.from("org-files").download(filePath);
    expect(error).not.toBeNull();
    const signed = await b.storage.from("org-files").createSignedUrl(filePath, 60);
    expect(signed.data?.signedUrl).toBeFalsy();
  });
  it("B cannot upload into A's folder", async () => {
    const { error } = await b.storage.from("org-files").upload(`${ORG_A}/documents/x/${tag()}.txt`, new Blob(["x"]));
    expect(error).not.toBeNull();
  });
  it("B cannot record a document version pointing at A's file path", async () => {
    const own = await b.from("documents").insert({ organization_id: ORG_B, title: tag() }).select("id").single();
    const { error } = await b.from("document_versions").insert({ organization_id: ORG_B, document_id: own.data!.id, version: 1, storage_path: filePath, file_name: "stolen" });
    expect(error?.message).toMatch(/organization folder/i);
  });
  it("B cannot create invitations for A", async () => {
    const { error } = await b.rpc("create_invitation", { _org: ORG_A, _email: "x@y.z", _role: "admin" });
    expect(error).not.toBeNull();
  });
  it("B cannot export A's data (every table returns nothing)", async () => {
    for (const t of tables) {
      const { data } = await b.from(t).select("*").eq("organization_id", ORG_A);
      expect(data ?? []).toHaveLength(0);
    }
  });
  it("A can still read its own records", async () => {
    const { data } = await a.from("agenda_items").select("notes").eq("id", agendaId).single();
    expect(data?.notes).toBe("confidential");
    const { data: file } = await a.storage.from("org-files").download(filePath);
    expect(await file?.text()).toBe("top secret");
  });
});
