// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, tag, type Client } from "./helpers";

describe.skipIf(!hasDb)("roles and permissions (live database)", () => {
  let owner: Client, member: Client;
  let meetingId: string;

  beforeAll(async () => {
    owner = await signIn("ownerA");
    member = await signIn("memberA");
    meetingId = (await owner.from("meetings").insert({ organization_id: ORG_A, title: tag(), meeting_date: "2026-12-02" }).select("id").single()).data!.id;
  });

  it("a board member can read the organization's meetings", async () => {
    const { data } = await member.from("meetings").select("id").eq("id", meetingId);
    expect(data).toHaveLength(1);
  });
  it("a board member cannot create meetings", async () => {
    const { error } = await member.from("meetings").insert({ organization_id: ORG_A, title: "x", meeting_date: "2026-12-02" });
    expect(error).not.toBeNull();
  });
  it("a board member cannot edit meetings or notes", async () => {
    const r = await member.from("meetings").update({ title: "changed" }).eq("id", meetingId).select("id");
    expect(r.data ?? []).toHaveLength(0);
  });
  it("a board member cannot record motions", async () => {
    const { error } = await member.from("motions").insert({ organization_id: ORG_A, meeting_id: meetingId, motion_text: "x" });
    expect(error).not.toBeNull();
  });
  it("a board member cannot read the audit log", async () => {
    const { data } = await member.from("audit_log").select("id").eq("organization_id", ORG_A);
    expect(data ?? []).toHaveLength(0);
  });
  it("a board member cannot create invitations", async () => {
    const { error } = await member.rpc("create_invitation", { _org: ORG_A, _email: "", _role: "member" });
    expect(error).not.toBeNull();
  });
  it("a board member cannot promote themselves", async () => {
    const r = await member.from("memberships").update({ role: "admin" }).eq("user_id", member.userId).eq("organization_id", ORG_A).select("id");
    expect(r.data ?? []).toHaveLength(0);
  });
  it("the owner role cannot be changed or removed through the app", async () => {
    const r = await owner.from("memberships").update({ role: "member" }).eq("user_id", owner.userId).eq("organization_id", ORG_A).select("id");
    expect(r.data ?? []).toHaveLength(0);
    const d = await owner.from("memberships").delete().eq("user_id", owner.userId).eq("organization_id", ORG_A).select("id");
    expect(d.data ?? []).toHaveLength(0);
  });
  it("an assignee can update their own task status", async () => {
    const t = await owner.from("action_items").insert({ organization_id: ORG_A, title: tag(), assignee_id: member.userId }).select("id").single();
    const r = await member.from("action_items").update({ status: "done" }).eq("id", t.data!.id).select("status");
    expect(r.data?.[0]?.status).toBe("done");
  });
  it("a board member cannot update someone else's task", async () => {
    const t = await owner.from("action_items").insert({ organization_id: ORG_A, title: tag(), assignee_id: owner.userId }).select("id").single();
    const r = await member.from("action_items").update({ status: "done" }).eq("id", t.data!.id).select("id");
    expect(r.data ?? []).toHaveLength(0);
  });
  it("users can only see profiles of people who share an organization", async () => {
    const { data } = await member.from("profiles").select("email");
    const emails = (data ?? []).map((p) => p.email);
    expect(emails).toContain("test-a@demo.org");
    expect(emails).not.toContain("test-b@demo.org");
    expect(emails).not.toContain("demo@demo.org");
  });
});

describe.skipIf(!hasDb)("invitations (live database)", () => {
  let owner: Client, member: Client;
  beforeAll(async () => {
    owner = await signIn("ownerA");
    member = await signIn("memberA");
  });

  it("only a hash of the token is stored", async () => {
    const { data: token } = await owner.rpc("create_invitation", { _org: ORG_A, _email: "", _role: "member" });
    const { data } = await owner.from("invitations").select("token_hash").eq("organization_id", ORG_A).is("accepted_at", null);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect((data ?? []).some((i) => i.token_hash === token)).toBe(false);
  });
  it("an owner role cannot be handed out by invitation", async () => {
    const { error } = await owner.rpc("create_invitation", { _org: ORG_A, _email: "", _role: "owner" });
    expect(error?.message).toMatch(/owner/i);
  });
  it("an invite link works once and then stops working", async () => {
    const { data: token } = await owner.rpc("create_invitation", { _org: ORG_A, _email: "", _role: "member" });
    const first = await member.rpc("accept_invitation", { _token: token as string });
    expect(first.error).toBeNull();
    expect(first.data).toBe(ORG_A);
    const second = await member.rpc("accept_invitation", { _token: token as string });
    expect(second.error?.message).toMatch(/invalid, expired or already used/);
  });
  it("a made-up token is rejected", async () => {
    const { error } = await member.rpc("accept_invitation", { _token: "deadbeef" });
    expect(error).not.toBeNull();
  });
});
