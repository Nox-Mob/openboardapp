import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, ORG_B, type Client } from "./helpers";

// Ownership transfer: every rule lives in transfer_ownership(), not the screen.
// The happy-path test hands Test Org A to the member and back, then restores the
// member's role, so Org A ends exactly as it started (owner A, member A).
describe.skipIf(!hasDb)("ownership transfer (live database)", () => {
  let a: Client; // owner of Test Org A
  let m: Client; // board member of Test Org A ("Test Member A")
  let b: Client; // owner of Test Org B (outsider)

  const roleIn = async (c: Client, org: string, user: string) =>
    (
      await c
        .from("memberships")
        .select("role")
        .eq("organization_id", org)
        .eq("user_id", user)
        .maybeSingle()
    ).data?.role;

  beforeAll(async () => {
    [a, m, b] = await Promise.all([signIn("ownerA"), signIn("memberA"), signIn("ownerB")]);
  });

  afterAll(async () => {
    // If a failure left the member as owner, hand Org A back and restore roles.
    if ((await roleIn(a, ORG_A, m.userId)) === "owner") {
      const name = (await m.rpc("ownership_transfer_candidates", { _org: ORG_A })).data?.find(
        (c) => c.user_id === a.userId,
      )?.confirm_text;
      if (name)
        await m.rpc("transfer_ownership", {
          _org: ORG_A,
          _new_owner: a.userId,
          _confirmation: name,
        });
    }
    await a
      .from("memberships")
      .update({ role: "member" })
      .eq("organization_id", ORG_A)
      .eq("user_id", m.userId);
  });

  it("only the owner can list who ownership could go to", async () => {
    expect((await m.rpc("ownership_transfer_candidates", { _org: ORG_A })).error).toBeTruthy();
    expect((await b.rpc("ownership_transfer_candidates", { _org: ORG_A })).error).toBeTruthy();
  });

  it("the owner sees other active members, with the name to type", async () => {
    const { data, error } = await a.rpc("ownership_transfer_candidates", { _org: ORG_A });
    expect(error).toBeNull();
    const ids = (data ?? []).map((c) => c.user_id);
    expect(ids).toContain(m.userId);
    expect(ids).not.toContain(a.userId);
    expect(ids).not.toContain(b.userId);
    expect(data?.find((c) => c.user_id === m.userId)?.confirm_text).toBe("Test Member A");
  });

  it("a member or an outsider cannot transfer ownership", async () => {
    const asMember = await m.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: m.userId,
      _confirmation: "Test Member A",
    });
    expect(asMember.error?.message).toMatch(/only the owner/i);
    const asOutsider = await b.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: b.userId,
      _confirmation: "Test Owner B",
    });
    expect(asOutsider.error?.message).toMatch(/only the owner/i);
  });

  it("the typed confirmation must be the new owner's name", async () => {
    for (const wrong of ["", "TRANSFER OWNERSHIP", "Test Member", "Test Owner A"]) {
      const r = await a.rpc("transfer_ownership", {
        _org: ORG_A,
        _new_owner: m.userId,
        _confirmation: wrong,
      });
      expect(r.error?.message).toMatch(/does not match/i);
    }
    expect(await roleIn(a, ORG_A, a.userId)).toBe("owner");
  });

  it("ownership cannot go to yourself or to someone outside the organization", async () => {
    const self = await a.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: a.userId,
      _confirmation: "Test Owner A",
    });
    expect(self.error?.message).toMatch(/another member/i);
    const outsider = await a.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: b.userId,
      _confirmation: "Test Owner B",
    });
    expect(outsider.error?.message).toMatch(/not a member/i);
  });

  it("ownership still cannot be changed by editing memberships directly", async () => {
    await a
      .from("memberships")
      .update({ role: "owner" })
      .eq("organization_id", ORG_A)
      .eq("user_id", m.userId);
    expect(await roleIn(a, ORG_A, m.userId)).toBe("member");
    expect(await roleIn(a, ORG_A, a.userId)).toBe("owner");
  });

  it("a confirmed transfer swaps owner and administrator, and can be handed back", async () => {
    const there = await a.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: m.userId,
      _confirmation: "  test member a ",
    });
    expect(there.error).toBeNull();
    expect(await roleIn(a, ORG_A, m.userId)).toBe("owner");
    expect(await roleIn(a, ORG_A, a.userId)).toBe("admin");

    // The former owner is now an administrator and can no longer transfer.
    const stale = await a.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: a.userId,
      _confirmation: "Test Owner A",
    });
    expect(stale.error?.message).toMatch(/only the owner/i);

    // Both role changes are in the audit log, attributed to the old owner.
    const { data: audit } = await m
      .from("audit_log")
      .select("actor_id, entity, summary")
      .eq("organization_id", ORG_A)
      .eq("entity", "memberships")
      .order("created_at", { ascending: false })
      .limit(2);
    expect((audit ?? []).map((r) => r.summary).sort()).toEqual(["admin", "owner"]);
    expect((audit ?? []).every((r) => r.actor_id === a.userId)).toBe(true);

    const back = await m.rpc("transfer_ownership", {
      _org: ORG_A,
      _new_owner: a.userId,
      _confirmation: "Test Owner A",
    });
    expect(back.error).toBeNull();
    expect(await roleIn(a, ORG_A, a.userId)).toBe("owner");
    expect(await roleIn(a, ORG_A, m.userId)).toBe("admin");
  });

  it("each organization keeps exactly one owner", async () => {
    const owners = await b
      .from("memberships")
      .select("user_id")
      .eq("organization_id", ORG_B)
      .eq("role", "owner");
    expect(owners.data).toHaveLength(1);
  });
});
