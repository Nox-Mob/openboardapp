import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, ORG_B, type Client } from "./helpers";

describe.skipIf(!hasDb)("letterhead access (live database)", () => {
  let a: Client, member: Client, b: Client;
  const row = { organization_id: ORG_A, storage_path: `${ORG_A}/letterhead/test.png`, file_name: "test.png", mime_type: "image/png" };
  beforeAll(async () => { [a, member, b] = await Promise.all([signIn("ownerA"), signIn("memberA"), signIn("ownerB")]); });
  afterAll(async () => { await a.from("organization_letterheads").delete().eq("organization_id", ORG_A); });
  it("owners save letterhead and members read it", async () => {
    const r = await a.from("organization_letterheads").upsert(row, { onConflict: "organization_id" });
    expect(r.error).toBeNull();
    expect((await member.from("organization_letterheads").select("file_name").eq("organization_id", ORG_A)).data).toEqual([{ file_name: "test.png" }]);
  });
  it("members cannot replace letterhead", async () => {
    const r = await member.from("organization_letterheads").upsert({ ...row, file_name: "changed.png" }, { onConflict: "organization_id" });
    expect(r.error).toBeTruthy();
  });
  it("another organization cannot read letterhead", async () => {
    expect((await b.from("organization_letterheads").select("*").eq("organization_id", ORG_A)).data).toEqual([]);
  });
  it("rejects cross-organization file paths", async () => {
    expect((await a.from("organization_letterheads").upsert({ ...row, storage_path: `${ORG_B}/letterhead/test.png` }, { onConflict: "organization_id" })).error).toBeTruthy();
  });
  it("members cannot upload letterhead bytes", async () => {
    expect((await member.storage.from("org-files").upload(`${ORG_A}/letterhead/forbidden-${Date.now()}.png`, new Blob(["test"], { type: "image/png" }))).error).toBeTruthy();
  });
});