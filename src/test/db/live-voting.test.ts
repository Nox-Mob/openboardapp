import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasDb, signIn, ORG_A, tag, type Client } from "./helpers";

// Live member voting: every rule is enforced by the database, not the screen.
describe.skipIf(!hasDb)("live voting (live database)", () => {
  let a: Client; // owner of Test Org A
  let m: Client; // board member of Test Org A
  let b: Client; // owner of Test Org B (outsider)
  let meetingId: string;

  beforeAll(async () => {
    [a, m, b] = await Promise.all([signIn("ownerA"), signIn("memberA"), signIn("ownerB")]);
  });
  afterAll(async () => {
    await a
      .from("organizations")
      .update({
        vote_close_modes: ["chair"],
        vote_timer_minutes: null,
        decision_rule: "majority_cast",
        seconder_required: true,
        quorum_count: 1,
      })
      .eq("id", ORG_A);
  });
  beforeEach(async () => {
    await a
      .from("organizations")
      .update({
        vote_close_modes: ["chair"],
        decision_rule: "majority_cast",
        seconder_required: true,
        quorum_count: 1,
      })
      .eq("id", ORG_A);
    meetingId = (
      await a
        .from("meetings")
        .insert({
          organization_id: ORG_A,
          title: tag(),
          meeting_date: "2026-12-10",
          status: "in_progress",
        })
        .select("id")
        .single()
    ).data!.id;
  });

  async function attend(c: Client, status: "present" | "absent", name: string) {
    const r = await a
      .from("attendance")
      .insert({
        organization_id: ORG_A,
        meeting_id: meetingId,
        user_id: c.userId,
        person_name: name,
        status,
      })
      .select("id")
      .single();
    if (r.error) throw r.error;
    return r.data.id;
  }
  async function open(text = "Approve the budget") {
    const r = await a.rpc("start_vote", {
      _meeting: meetingId,
      _agenda_item: null as unknown as string,
      _text: text,
      _moved_by: "Owner",
      _seconded_by: "Member",
    });
    if (r.error) throw r.error;
    return r.data as string;
  }

  it("votes cannot open unless the meeting is in progress", async () => {
    await attend(a, "present", "Owner");
    await a.from("meetings").update({ status: "scheduled" }).eq("id", meetingId);
    await expect(open()).rejects.toThrow(/in progress/);
  });
  it("a seconder is required when the organization says so", async () => {
    await attend(a, "present", "Owner");
    const r = await a.rpc("start_vote", {
      _meeting: meetingId,
      _agenda_item: null as unknown as string,
      _text: "X",
      _moved_by: "Owner",
      _seconded_by: null as unknown as string,
    });
    expect(r.error?.message).toMatch(/seconder/);
  });
  it("only one vote can be open at a time", async () => {
    await attend(a, "present", "Owner");
    await open();
    await expect(open("Second motion")).rejects.toThrow(/already open/);
  });
  it("a member votes once; the vote can't be repeated, changed or deleted — even by the owner", async () => {
    await attend(a, "present", "Owner");
    await attend(m, "present", "Member");
    const id = await open();
    expect((await m.rpc("cast_vote", { _motion: id, _vote: "yes" })).data).toBe("recorded");
    expect((await m.rpc("cast_vote", { _motion: id, _vote: "no" })).error?.message).toMatch(
      /already voted/,
    );
    await a.rpc("close_vote", { _motion: id });
    const del = await a.from("member_votes").delete().eq("motion_id", id).select("id");
    const upd = await a
      .from("member_votes")
      .update({ vote: "no" })
      .eq("motion_id", id)
      .select("id");
    expect(del.data ?? []).toHaveLength(0);
    expect(upd.data ?? []).toHaveLength(0);
    const { data } = await a.from("member_votes").select("vote").eq("motion_id", id);
    expect(data).toEqual([{ vote: "yes" }]);
  });
  it("someone marked present after the vote opened cannot vote", async () => {
    await attend(a, "present", "Owner");
    const late = await attend(m, "absent", "Member");
    const id = await open();
    await a.from("attendance").update({ status: "present" }).eq("id", late);
    expect((await m.rpc("cast_vote", { _motion: id, _vote: "yes" })).error?.message).toMatch(
      /not on the voter list/,
    );
  });
  it("votes are rejected once the meeting leaves in-progress", async () => {
    await attend(a, "present", "Owner");
    await attend(m, "present", "Member");
    const id = await open();
    await a.from("meetings").update({ status: "completed" }).eq("id", meetingId);
    expect((await m.rpc("cast_vote", { _motion: id, _vote: "yes" })).error?.message).toMatch(
      /in progress/,
    );
  });
  it("another organization can't vote, close or read the electorate", async () => {
    await attend(a, "present", "Owner");
    const id = await open();
    expect((await b.rpc("cast_vote", { _motion: id, _vote: "yes" })).error).toBeTruthy();
    expect((await b.rpc("close_vote", { _motion: id })).error).toBeTruthy();
    expect(
      (await b.from("vote_electorate").select("id").eq("motion_id", id)).data ?? [],
    ).toHaveLength(0);
  });
  it("a board member without a closing role can't close the vote", async () => {
    await attend(a, "present", "Owner");
    const id = await open();
    expect((await m.rpc("close_vote", { _motion: id })).error?.message).toMatch(/role/);
  });
  it("closing records counts, non-voters and the calculated result", async () => {
    await attend(a, "present", "Owner");
    await attend(m, "present", "Member");
    const id = await open();
    await a.rpc("cast_vote", { _motion: id, _vote: "yes" });
    await a.rpc("close_vote", { _motion: id });
    const { data } = await a.from("motions").select("*").eq("id", id).single();
    expect(data?.voting_status).toBe("closed");
    expect(data?.outcome).toBe("carried");
    expect(data?.disposition_source).toBe("calculated");
    const rec = data?.vote_record as {
      not_voting: string[];
      electorate: string[];
      quorum_met: boolean;
      closed_how: string;
    };
    expect(rec.not_voting).toEqual(["Member"]);
    expect(rec.electorate).toEqual(["Member", "Owner"]);
    expect(rec.quorum_met).toBe(true);
    expect(rec.closed_how).toBe("chair");
  });
  it("closes automatically when everyone has voted, if the organization allows it", async () => {
    await a
      .from("organizations")
      .update({ vote_close_modes: ["auto"] })
      .eq("id", ORG_A);
    await attend(a, "present", "Owner");
    await attend(m, "present", "Member");
    const id = await open();
    await a.rpc("cast_vote", { _motion: id, _vote: "no" });
    await m.rpc("cast_vote", { _motion: id, _vote: "no" });
    const { data } = await a
      .from("motions")
      .select("voting_status, outcome, vote_record")
      .eq("id", id)
      .single();
    expect(data?.voting_status).toBe("closed");
    expect(data?.outcome).toBe("failed");
    expect((data?.vote_record as { closed_how: string }).closed_how).toBe("all_voted");
  });
  it("without quorum no result is calculated; an explained disposition is required", async () => {
    await a.from("organizations").update({ quorum_count: 5 }).eq("id", ORG_A);
    await attend(a, "present", "Owner");
    const id = await open();
    await a.rpc("cast_vote", { _motion: id, _vote: "yes" });
    await a.rpc("close_vote", { _motion: id });
    expect((await a.from("motions").select("outcome").eq("id", id).single()).data?.outcome).toBe(
      "pending",
    );
    expect(
      (await a.rpc("record_disposition", { _motion: id, _outcome: "failed", _note: "" })).error
        ?.message,
    ).toMatch(/explanation/);
    expect(
      (
        await a.rpc("record_disposition", {
          _motion: id,
          _outcome: "failed",
          _note: "No quorum per bylaws",
        })
      ).error,
    ).toBeNull();
    const { data } = await a
      .from("motions")
      .select("outcome, disposition_source, disposition_note")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      outcome: "failed",
      disposition_source: "recorded",
      disposition_note: "No quorum per bylaws",
    });
  });
  it("a live-voted motion can't be edited or deleted directly", async () => {
    await attend(a, "present", "Owner");
    const id = await open();
    await a.rpc("close_vote", { _motion: id });
    expect((await a.from("motions").update({ votes_yes: 9 }).eq("id", id)).error?.message).toMatch(
      /official record/,
    );
    expect((await a.from("motions").delete().eq("id", id)).error).toBeTruthy();
    expect(
      (
        await a.from("motions").insert({
          organization_id: ORG_A,
          meeting_id: meetingId,
          motion_text: "fake",
          voting_status: "closed",
        })
      ).error,
    ).toBeTruthy();
  });
  it("other members can't see how someone voted until the vote closes", async () => {
    await attend(a, "present", "Owner");
    await attend(m, "present", "Member");
    const id = await open();
    await a.rpc("cast_vote", { _motion: id, _vote: "yes" });
    expect((await m.from("member_votes").select("id").eq("motion_id", id)).data ?? []).toHaveLength(
      0,
    );
    expect((await m.rpc("vote_progress", { _motion: id })).data).toEqual({
      cast: 1,
      electorate: 2,
    });
    await a.rpc("close_vote", { _motion: id });
    expect((await m.from("member_votes").select("id").eq("motion_id", id)).data ?? []).toHaveLength(
      1,
    );
  });
  it("a vote item's own decision rule (e.g. two-thirds for bylaws) overrides the organization default", async () => {
    await attend(a, "present", "Owner");
    await attend(m, "present", "Member");
    const item = (
      await a
        .from("agenda_items")
        .insert({
          organization_id: ORG_A,
          meeting_id: meetingId,
          title: "Bylaws amendment",
          position: 0,
          is_vote_item: true,
          decision_rule: "two_thirds_cast",
        })
        .select("id")
        .single()
    ).data!.id;
    const r = await a.rpc("start_vote", {
      _meeting: meetingId,
      _agenda_item: item,
      _text: "Amend Article 3",
      _moved_by: "Owner",
      _seconded_by: "Member",
    });
    expect(r.error).toBeNull();
    await a.rpc("cast_vote", { _motion: r.data as string, _vote: "yes" });
    await m.rpc("cast_vote", { _motion: r.data as string, _vote: "no" });
    await a.rpc("close_vote", { _motion: r.data as string });
    const { data } = await a
      .from("motions")
      .select("outcome, vote_record")
      .eq("id", r.data as string)
      .single();
    // 1 of 2 is a simple-majority tie (fails either way) — check the rule recorded, and that 1/2 < 2/3 fails.
    expect(data?.vote_record as { decision_rule: string; org_default_rule: string }).toMatchObject({
      decision_rule: "two_thirds_cast",
      org_default_rule: "majority_cast",
    });
    expect(data?.outcome).toBe("failed");
  });
});
