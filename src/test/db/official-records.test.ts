import { beforeEach, beforeAll, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, tag, type Client } from "./helpers";

// Release blocker: approved minutes and recorded decisions stay identifiable and unchanged.
describe.skipIf(!hasDb)("official record versioning (live database)", () => {
  let a: Client;
  let meetingId: string;

  beforeAll(async () => {
    a = await signIn("ownerA");
  });
  beforeEach(async () => {
    meetingId = (
      await a
        .from("meetings")
        .insert({ organization_id: ORG_A, title: tag(), meeting_date: "2026-12-03" })
        .select("id")
        .single()
    ).data!.id;
  });

  async function draft(version: number, content = "Draft minutes") {
    const r = await a
      .from("minutes")
      .insert({ organization_id: ORG_A, meeting_id: meetingId, version, content })
      .select("id")
      .single();
    if (r.error) throw r.error;
    return r.data.id;
  }

  it("minutes must be submitted before they can be approved", async () => {
    const id = await draft(1);
    const { error } = await a.from("minutes").update({ status: "approved" }).eq("id", id);
    expect(error?.message).toMatch(/submitted before approval/);
  });
  it("submit then approve records who approved and when", async () => {
    const id = await draft(1);
    await a.from("minutes").update({ status: "submitted" }).eq("id", id);
    const { data } = await a
      .from("minutes")
      .update({ status: "approved" })
      .eq("id", id)
      .select("*")
      .single();
    expect(data?.status).toBe("approved");
    expect(data?.approved_by).toBe(a.userId);
    expect(data?.approved_at).toBeTruthy();
    expect(data?.submitted_at).toBeTruthy();
  });
  it("approved minutes cannot be edited", async () => {
    const id = await draft(1, "Official text");
    await a.from("minutes").update({ status: "submitted" }).eq("id", id);
    await a.from("minutes").update({ status: "approved" }).eq("id", id);
    const { error } = await a.from("minutes").update({ content: "Rewritten history" }).eq("id", id);
    expect(error?.message).toMatch(/locked/);
    const { data } = await a.from("minutes").select("content").eq("id", id).single();
    expect(data?.content).toBe("Official text");
  });
  it("approved minutes cannot be deleted", async () => {
    const id = await draft(1);
    await a.from("minutes").update({ status: "submitted" }).eq("id", id);
    await a.from("minutes").update({ status: "approved" }).eq("id", id);
    const { error } = await a.from("minutes").delete().eq("id", id);
    expect(error?.message).toMatch(/official record/);
  });
  it("approving an amendment supersedes the earlier version, which stays readable", async () => {
    const v1 = await draft(1, "Version one");
    await a.from("minutes").update({ status: "submitted" }).eq("id", v1);
    await a.from("minutes").update({ status: "approved" }).eq("id", v1);
    const v2 = await draft(2, "Version two");
    await a.from("minutes").update({ status: "submitted" }).eq("id", v2);
    await a.from("minutes").update({ status: "approved" }).eq("id", v2);
    const { data } = await a
      .from("minutes")
      .select("version, status, content")
      .eq("meeting_id", meetingId)
      .order("version");
    expect(data).toEqual([
      { version: 1, status: "superseded", content: "Version one" },
      { version: 2, status: "approved", content: "Version two" },
    ]);
  });
  it("two minutes rows cannot share a version number", async () => {
    await draft(1);
    const { error } = await a
      .from("minutes")
      .insert({ organization_id: ORG_A, meeting_id: meetingId, version: 1, content: "dup" });
    expect(error).not.toBeNull();
  });
  it("motions and attendance lock once minutes are approved", async () => {
    const motion = await a
      .from("motions")
      .insert({
        organization_id: ORG_A,
        meeting_id: meetingId,
        motion_text: "Approve",
        outcome: "carried",
        votes_yes: 3,
      })
      .select("id")
      .single();
    const att = await a
      .from("attendance")
      .insert({ organization_id: ORG_A, meeting_id: meetingId, person_name: "Ann" })
      .select("id")
      .single();
    const id = await draft(1);
    await a.from("minutes").update({ status: "submitted" }).eq("id", id);
    await a.from("minutes").update({ status: "approved" }).eq("id", id);
    expect(
      (await a.from("motions").update({ outcome: "failed" }).eq("id", motion.data!.id)).error
        ?.message,
    ).toMatch(/can no longer be changed/);
    expect((await a.from("motions").delete().eq("id", motion.data!.id)).error?.message).toMatch(
      /can no longer be changed/,
    );
    expect(
      (await a.from("attendance").update({ status: "absent" }).eq("id", att.data!.id)).error
        ?.message,
    ).toMatch(/can no longer be changed/);
  });
  it("archived meetings lock their motions", async () => {
    const motion = await a
      .from("motions")
      .insert({ organization_id: ORG_A, meeting_id: meetingId, motion_text: "Archive test" })
      .select("id")
      .single();
    await a.from("meetings").update({ status: "archived" }).eq("id", meetingId);
    const { error } = await a.from("motions").update({ votes_yes: 9 }).eq("id", motion.data!.id);
    expect(error?.message).toMatch(/archived/);
  });
  it("action items stay visible after their meeting is archived", async () => {
    const t = await a
      .from("action_items")
      .insert({
        organization_id: ORG_A,
        meeting_id: meetingId,
        title: "Follow up",
        assignee_id: a.userId,
        due_date: "2026-12-20",
      })
      .select("id")
      .single();
    await a.from("meetings").update({ status: "archived" }).eq("id", meetingId);
    const { data } = await a
      .from("action_items")
      .select("id")
      .eq("assignee_id", a.userId)
      .eq("id", t.data!.id);
    expect(data).toHaveLength(1);
  });
  it("a distributed packet cannot be deleted or replaced", async () => {
    const p = await a
      .from("packets")
      .insert({
        organization_id: ORG_A,
        meeting_id: meetingId,
        version: 1,
        storage_path: `${ORG_A}/packets/${meetingId}/v1.pdf`,
      })
      .select("id")
      .single();
    await a
      .from("packets")
      .update({ distributed_at: new Date().toISOString() })
      .eq("id", p.data!.id);
    expect((await a.from("packets").delete().eq("id", p.data!.id)).error?.message).toMatch(
      /kept as a record/,
    );
    expect(
      (
        await a
          .from("packets")
          .update({ storage_path: `${ORG_A}/packets/other.pdf` })
          .eq("id", p.data!.id)
      ).error?.message,
    ).toMatch(/cannot be changed/);
  });
  it("packet files must live in the organization's folder", async () => {
    const { error } = await a
      .from("packets")
      .insert({
        organization_id: ORG_A,
        meeting_id: meetingId,
        version: 1,
        storage_path: "elsewhere/v1.pdf",
      });
    expect(error?.message).toMatch(/organization folder/);
  });
});

describe.skipIf(!hasDb)("audit trail (live database)", () => {
  it("records who created and changed a meeting", async () => {
    const a = await signIn("ownerA");
    const title = tag();
    const m = await a
      .from("meetings")
      .insert({ organization_id: ORG_A, title, meeting_date: "2026-12-04" })
      .select("id")
      .single();
    await a.from("meetings").update({ status: "scheduled" }).eq("id", m.data!.id);
    const { data } = await a
      .from("audit_log")
      .select("action, actor_id, entity")
      .eq("entity_id", m.data!.id)
      .order("id");
    expect(data?.map((r) => r.action)).toEqual(["insert", "update"]);
    expect(data?.every((r) => r.actor_id === a.userId && r.entity === "meetings")).toBe(true);
  });
  it("nobody can write or erase audit entries", async () => {
    const a = await signIn("ownerA");
    const ins = await a
      .from("audit_log")
      .insert({ organization_id: ORG_A, action: "insert", entity: "fake" });
    expect(ins.error).not.toBeNull();
    const del = await a.from("audit_log").delete().eq("organization_id", ORG_A).select("id");
    expect(del.data ?? []).toHaveLength(0);
  });
});
