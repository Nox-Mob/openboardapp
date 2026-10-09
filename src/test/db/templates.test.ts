import { beforeAll, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, tag, type Client } from "./helpers";

describe.skipIf(!hasDb)("meeting templates (live database)", () => {
  let a: Client, member: Client, b: Client;
  beforeAll(async () => {
    [a, member, b] = await Promise.all([signIn("ownerA"), signIn("memberA"), signIn("ownerB")]);
  });

  async function make() {
    const r = await a
      .from("meeting_templates")
      .insert({ organization_id: ORG_A, name: tag(), agenda: [{ title: "Call to order" }] })
      .select("id")
      .single();
    if (r.error) throw r.error;
    return r.data.id;
  }

  it("editors can create a template and members can read it", async () => {
    const id = await make();
    const { data } = await member.from("meeting_templates").select("id").eq("id", id);
    expect(data).toHaveLength(1);
  });
  it("plain members cannot create templates", async () => {
    const { error } = await member
      .from("meeting_templates")
      .insert({ organization_id: ORG_A, name: tag() });
    expect(error).toBeTruthy();
  });
  it("another organization cannot see or delete the template", async () => {
    const id = await make();
    expect((await b.from("meeting_templates").select("id").eq("id", id)).data).toEqual([]);
    await b.from("meeting_templates").delete().eq("id", id);
    expect((await a.from("meeting_templates").select("id").eq("id", id)).data).toHaveLength(1);
  });
  it("template names are unique within an organization", async () => {
    const name = tag();
    await a.from("meeting_templates").insert({ organization_id: ORG_A, name });
    const { error } = await a.from("meeting_templates").insert({ organization_id: ORG_A, name });
    expect(error).toBeTruthy();
  });
  it("agenda must be a list", async () => {
    const { error } = await a
      .from("meeting_templates")
      .insert({ organization_id: ORG_A, name: tag(), agenda: { title: "x" } });
    expect(error).toBeTruthy();
  });
  it("template changes are written to the audit log", async () => {
    const id = await make();
    const { data } = await a
      .from("audit_log")
      .select("action")
      .eq("entity", "meeting_templates")
      .eq("entity_id", id);
    expect(data?.map((r) => r.action)).toContain("insert");
  });
});
