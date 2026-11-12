import { beforeEach, describe, expect, it, vi } from "vitest";

// B-11: multi-step changes are one database call, and a file whose record fails is removed.
const calls = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  uploads: [] as string[],
  removed: [] as string[],
  rpcError: null as null | { message: string },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.rpc.push({ fn, args });
      return Promise.resolve(
        calls.rpcError ? { data: null, error: calls.rpcError } : { data: "new-id", error: null },
      );
    },
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: calls.rpcError }),
    }),
    storage: {
      from: () => ({
        upload: (path: string) => {
          calls.uploads.push(path);
          return Promise.resolve({ data: { path }, error: null });
        },
        remove: (paths: string[]) => {
          calls.removed.push(...paths);
          return Promise.resolve({ data: [], error: null });
        },
      }),
    },
  },
}));

const { cloudAdapter } = await import("./cloud-adapter");

beforeEach(() => {
  calls.rpc = [];
  calls.uploads = [];
  calls.removed = [];
  calls.rpcError = null;
});

describe("atomic changes (B-11)", () => {
  it("creates a meeting and its agenda in one call", async () => {
    const id = await cloudAdapter.meetings.create(
      { org_id: "o1", title: "Regular", meeting_date: "2026-12-01", start_time: "6:30 PM" },
      [{ title: "Call to order" }, { title: " " }, { title: "Budget", duration_minutes: 20 }],
    );
    expect(id).toBe("new-id");
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0]!.fn).toBe("create_meeting_with_agenda");
    expect(calls.rpc[0]!.args["p_agenda"]).toEqual([
      expect.objectContaining({ title: "Call to order" }),
      expect.objectContaining({ title: "Budget", duration_minutes: 20 }),
    ]);
  });

  it("hands a role over in one call", async () => {
    await cloudAdapter.terms.assign({
      org_id: "o1",
      position_id: "p1",
      position: "Treasurer",
      person_name: "Tess",
      start_date: "2026-01-01",
    });
    expect(calls.rpc.map((c) => c.fn)).toEqual(["assign_term"]);
    expect(calls.rpc[0]!.args).toMatchObject({ p_position_id: "p1", p_start_date: "2026-01-01" });
  });

  it("saves a new document with its file, and removes the file when the record fails", async () => {
    const file = new File(["x"], "By laws.pdf", { type: "application/pdf" });
    await cloudAdapter.documents.createWithFile(
      { org_id: "o1", title: "Bylaws", category: "General", meeting_id: null },
      file,
    );
    expect(calls.uploads[0]).toMatch(/^o1\/documents\/[0-9a-f-]{36}\/v1-By_laws\.pdf$/);
    expect(calls.rpc[0]!.args["p_storage_path"]).toBe(calls.uploads[0]);
    expect(calls.removed).toEqual([]);

    calls.rpcError = { message: "boom" };
    await expect(
      cloudAdapter.documents.createWithFile(
        { org_id: "o1", title: "Bad", category: "General", meeting_id: null },
        file,
      ),
    ).rejects.toBeTruthy();
    expect(calls.removed).toEqual([calls.uploads[1]]);
  });

  it("removes a packet's PDF when its record fails", async () => {
    calls.rpcError = { message: "boom" };
    await expect(
      cloudAdapter.packets.create(
        { org_id: "o1", meeting_id: "m1", version: 1, storage_path: "o1/packets/p.pdf" } as never,
        new Blob(["%PDF"]),
      ),
    ).rejects.toBeTruthy();
    expect(calls.removed).toEqual(["o1/packets/p.pdf"]);
  });
});
