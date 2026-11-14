import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Vote as VoteIcon } from "lucide-react";
import { attempt, db } from "@/data";
import { useCurrentOrg, useTitles } from "@/lib/org-context";

import { errorMessage } from "@/lib/export";
import { signedUrl } from "@/lib/meeting-data";
import {
  DECISION_RULES,
  type DecisionRule,
  canCloseEarly,
  presentAttendees,
  VOTE_LABEL,
  VOTE_PHRASE,
  VOTES,
  quorumStatus,
  type Vote,
} from "@/lib/votes";
import { PageHeader, LoadingState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { DispositionForm, VoteRecordView } from "@/components/meeting/VoteRecord";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/board/live/$meetingId")({
  head: () => ({
    meta: [
      { title: "Board Meeting Dashboard — OpenBoardApp" },
      {
        name: "description",
        content: "Follow the agenda, read the packet and cast official meeting votes.",
      },
      { property: "og:title", content: "Board Meeting Dashboard — OpenBoardApp" },
      {
        property: "og:description",
        content: "Follow the agenda, read the packet and cast official meeting votes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveMeeting,
});

const POLL = 3000;

function LiveMeeting() {
  const { meetingId } = Route.useParams();
  const { org, can } = useCurrentOrg();
  const qc = useQueryClient();
  const meeting = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => db.meetings.get(meetingId),
    refetchInterval: POLL,
  });
  const agenda = useQuery({
    queryKey: ["agenda", meetingId],
    queryFn: () => db.agenda.list(meetingId),
    refetchInterval: POLL * 3,
  });
  const motions = useQuery({
    queryKey: ["motions", meetingId],
    queryFn: () => db.motions.list(meetingId),
    refetchInterval: POLL,
  });
  const attendance = useQuery({
    queryKey: ["attendance", meetingId],
    queryFn: () => db.attendance.list(meetingId),
    refetchInterval: POLL * 2,
  });
  const [draft, setDraft] = useState<{ agenda_item_id: string | null; motion_text: string } | null>(
    null,
  );
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["motions", meetingId] });
    void qc.invalidateQueries({ queryKey: ["vote"] });
  };

  if (meeting.isLoading) return <LoadingState />;
  const m = meeting.data;
  if (!m || m.org_id !== org.id)
    return (
      <EmptyState title="Meeting not found">
        <Link to="/board/meetings" className="text-primary underline">
          Back to meetings
        </Link>
      </EmptyState>
    );

  const live = m.status === "in_progress";
  const openMotion = motions.data?.find((x) => x.voting_status === "open");
  const liveVotes = (motions.data ?? []).filter((x) => x.voting_status === "closed").reverse();
  const officer = can("records.edit");

  return (
    <>
      <PageHeader
        eyebrow={`Board Meeting Dashboard · ${m.meeting_date}`}
        title={m.title}
        actions={<StatusBadge status={m.status} />}
      >
        <Link
          to="/board/meetings/$meetingId"
          params={{ meetingId }}
          className="text-primary underline"
        >
          Full meeting record
        </Link>
      </PageHeader>
      {!live && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          Voting is only available while the meeting is <strong>In progress</strong>. This meeting
          is {m.status.replace("_", " ")}.
        </div>
      )}
      <QuorumBar attendance={attendance.data ?? []} required={org.quorum_count} />
      <Tabs defaultValue="vote">
        <TabsList className="mb-4 w-full justify-start">
          <TabsTrigger value="vote">Vote{openMotion ? " •" : ""}</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="packet">Board packet</TabsTrigger>
        </TabsList>

        <TabsContent value="vote" className="space-y-4">
          {openMotion ? (
            <OpenVote motion={openMotion} live={live} onChange={refresh} />
          ) : (
            <EmptyState title="No vote is open">
              {live ? "When the chair opens a vote it appears here automatically." : null}
            </EmptyState>
          )}
          {officer && live && !openMotion && (
            <section className="rounded-lg border bg-card p-4">
              <p className="eyebrow">Open a vote</p>
              <div className="mt-2 space-y-2">
                {(agenda.data ?? [])
                  .filter((a) => a.is_vote_item)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {a.title} ·{" "}
                          {DECISION_RULES[(a.decision_rule ?? org.decision_rule) as DecisionRule]}
                        </p>
                        <p className="text-sm">{a.proposed_motion || "Motion to be stated"}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          setDraft({ agenda_item_id: a.id, motion_text: a.proposed_motion ?? "" })
                        }
                      >
                        Open vote
                      </Button>
                    </div>
                  ))}
                <Button
                  variant="outline"
                  onClick={() => setDraft({ agenda_item_id: null, motion_text: "" })}
                >
                  New motion (new business)
                </Button>
              </div>
            </section>
          )}
          {liveVotes.length > 0 && (
            <section className="space-y-3">
              <p className="eyebrow">Votes taken in this meeting</p>
              {liveVotes.map((x) => (
                <div key={x.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{x.motion_text}</p>
                    <StatusBadge status={x.outcome} />
                  </div>
                  <VoteRecordView motion={x} />
                  {org.vote_closer_roles.includes(org.role) && (
                    <DispositionForm motion={x} onDone={refresh} />
                  )}
                </div>
              ))}
            </section>
          )}
        </TabsContent>

        <TabsContent value="agenda">
          {!agenda.data?.length ? (
            <EmptyState title="No agenda items" />
          ) : (
            <ol className="space-y-2">
              {agenda.data.map((a, i) => (
                <li key={a.id} className="rounded-lg border bg-card p-4">
                  <p className="font-mono text-xs text-muted-foreground">
                    Item {i + 1}
                    {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                  </p>
                  <p className="font-display text-lg">{a.title}</p>
                  {a.presenter && <p className="text-sm text-muted-foreground">{a.presenter}</p>}
                  {a.description && <p className="mt-1 text-sm">{a.description}</p>}
                  {a.is_vote_item && (
                    <p className="mt-2 rounded-md bg-muted/50 p-2 text-sm">
                      <span className="eyebrow">
                        Vote item ·{" "}
                        {
                          DECISION_RULES[(a.decision_rule ?? org.decision_rule) as DecisionRule]
                        }{" "}
                      </span>
                      {a.proposed_motion}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="packet">
          <PacketPanel meetingId={meetingId} orgId={org.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a vote</DialogTitle>
          </DialogHeader>
          {draft && (
            <StartVoteForm
              meetingId={meetingId}
              draft={draft}
              attendees={presentAttendees(attendance.data ?? [])}
              seconderRequired={org.seconder_required}
              onDone={() => {
                setDraft(null);
                refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StartVoteForm({
  meetingId,
  draft,
  attendees,
  seconderRequired,
  onDone,
}: {
  meetingId: string;
  draft: { agenda_item_id: string | null; motion_text: string };
  attendees: { id: string; person_name: string; user_id: string | null }[];
  seconderRequired: boolean;
  onDone: () => void;
}) {
  const titles = useTitles(useCurrentOrg().org.id);
  const [text, setText] = useState(draft.motion_text);
  const [moved, setMoved] = useState("none");
  const [second, setSecond] = useState("none");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (seconderRequired && second === "none") {
      toast.error("Your organization requires a seconder");
      return;
    }
    setBusy(true);
    const { error } = await attempt(
      db.voting.start(meetingId, {
        agenda_item_id: draft.agenda_item_id,
        motion_text: text,
        moved_by: moved === "none" ? null : moved,
        seconded_by: second === "none" ? null : second,
      }),
    );
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    toast.success("Vote opened — members can vote now");
    onDone();
  }
  const pick = (label: string, v: string, set: (s: string) => void) => (
    <div>
      <Label>{label}</Label>
      <Select value={v} onValueChange={set}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not recorded</SelectItem>
          {attendees.map((a) => (
            <SelectItem key={a.id} value={a.person_name}>
              {titles.label(a.person_name, a.user_id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Motion</Label>
        <Textarea
          aria-label="Motion"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {pick("Moved by", moved, setMoved)}
        {pick(seconderRequired ? "Seconded by (required)" : "Seconded by", second, setSecond)}
      </div>
      <p className="text-xs text-muted-foreground">
        The voter list is fixed when you open the vote: only voting members marked present right now
        can vote.
      </p>
      <Button type="submit" className="w-full" disabled={busy}>
        Open vote
      </Button>
    </form>
  );
}

function OpenVote({
  motion,
  live,
  onChange,
}: {
  motion: {
    id: string;
    motion_text: string;
    moved_by: string | null;
    seconded_by: string | null;
    closes_at: string | null;
  };
  live: boolean;
  onChange: () => void;
}) {
  const { org, userId, readOnly } = useCurrentOrg();
  const progress = useQuery({
    queryKey: ["vote", "progress", motion.id],
    queryFn: () => db.voting.progress(motion.id),
    refetchInterval: POLL,
  });
  const electorate = useQuery({
    queryKey: ["vote", "electorate", motion.id],
    queryFn: () => db.voting.electorate(motion.id),
  });
  const mine = useQuery({
    queryKey: ["vote", "mine", motion.id],
    queryFn: () => db.voting.votes(motion.id),
  });
  const [confirm, setConfirm] = useState<Vote | null>(null);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(motion.closes_at);
  const fired = useRef(false);

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      void attempt(db.voting.close(motion.id)).then(onChange);
    }
  }, [left, motion.id, onChange]);

  const myVote = mine.data?.find((v) => v.user_id === userId);
  const eligible = electorate.data?.some((e) => e.user_id === userId);

  async function cast(v: Vote) {
    setBusy(true);
    const { data, error } = await attempt(db.voting.cast(motion.id, v));
    setBusy(false);
    setConfirm(null);
    if (error) {
      toast.error(errorMessage(error));
      onChange();
      return;
    }
    toast[data === "expired" ? "error" : "success"](
      data === "expired"
        ? "Voting time had already ended — your vote was not counted"
        : "Your official vote is recorded",
    );
    void mine.refetch();
    onChange();
  }

  async function close() {
    if (
      !window.confirm(
        "Close this vote now? Members who haven't voted will be recorded as not voting.",
      )
    )
      return;
    const { error } = await attempt(db.voting.close(motion.id));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    toast.success("Vote closed");
    onChange();
  }

  return (
    <section className="rounded-lg border-2 border-primary/50 bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1">
          <VoteIcon className="h-3.5 w-3.5" /> Vote open
        </p>
        {left !== null && (
          <p className="font-mono text-sm">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left
          </p>
        )}
      </div>
      <p className="mt-2 font-display text-xl leading-snug">{motion.motion_text}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {[
          motion.moved_by && `Moved by ${motion.moved_by}`,
          motion.seconded_by && `seconded by ${motion.seconded_by}`,
        ]
          .filter(Boolean)
          .join(", ")}
      </p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {progress.data
          ? `${progress.data.cast} of ${progress.data.electorate} eligible members have voted`
          : "…"}
      </p>

      {myVote ? (
        <p className="mt-4 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm font-medium">
          Your vote is recorded: {VOTE_LABEL[myVote.vote as Vote]}. It cannot be changed.
        </p>
      ) : !live ? null : readOnly ? (
        <p className="mt-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Board is read-only for this organization, so votes can't be cast.
        </p>
      ) : eligible === false ? (
        <p className="mt-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          You are not on the voter list for this motion. Only voting members present when it was
          opened can vote.
        </p>
      ) : eligible ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOTES.map((v) => (
            <Button
              key={v}
              size="lg"
              variant={v === "yes" ? "default" : v === "no" ? "destructive" : "outline"}
              className="h-14 text-base"
              disabled={busy}
              onClick={() => setConfirm(v)}
            >
              {VOTE_LABEL[v]}
            </Button>
          ))}
        </div>
      ) : null}

      {!readOnly && canCloseEarly(org.role, org) && (
        <Button variant="outline" className="mt-4" onClick={close}>
          Close vote
        </Button>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your official vote</AlertDialogTitle>
            <AlertDialogDescription>
              This will be your official vote and it cannot be changed by anyone, including you. Are
              you sure you wish to vote <strong>{confirm ? VOTE_PHRASE[confirm] : ""}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void cast(confirm);
              }}
            >
              Yes, cast my vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function useCountdown(until: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
}

function PacketPanel({ meetingId, orgId }: { meetingId: string; orgId: string }) {
  const packets = useQuery({
    queryKey: ["packets", meetingId],
    queryFn: () => db.packets.list(meetingId),
  });
  const docs = useQuery({
    queryKey: ["documents", orgId],
    queryFn: () => db.documents.list(orgId),
  });
  const open = async (path: string) => {
    const { data, error } = await attempt(signedUrl(path));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    window.open(data ?? undefined, "_blank", "noopener");
  };
  if (packets.isLoading || docs.isLoading) return <LoadingState />;
  const latest = packets.data?.[0];
  const attached = (docs.data ?? []).filter((d) => d.meeting_id === meetingId);
  return (
    <div className="space-y-3">
      {latest ? (
        <Button onClick={() => open(latest.storage_path)}>
          <FileText className="mr-2 h-4 w-4" />
          Open board packet (version {latest.version})
        </Button>
      ) : (
        <EmptyState title="No board packet yet" />
      )}
      {attached.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {attached.map((d) => {
            const v = [...(d.document_versions ?? [])].sort((a, b) => b.version - a.version)[0];
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>{d.title}</span>
                {v && (
                  <Button size="sm" variant="outline" onClick={() => open(v.storage_path)}>
                    Open
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Live quorum indicator: refreshes with attendance while the meeting runs. */
function QuorumBar({
  attendance,
  required,
}: {
  attendance: { status: string; is_voting: boolean; person_name: string; id: string }[];
  required: number;
}) {
  const q = quorumStatus(attendance, required);
  return (
    <div
      role="status"
      aria-label="Quorum"
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3 text-sm ${q.met ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5 text-destructive"}`}
    >
      <span className="font-medium">
        {q.met
          ? "Quorum met"
          : `Quorum not met — ${q.short} more voting member${q.short === 1 ? "" : "s"} needed`}
      </span>
      <span className="font-mono text-xs">
        {q.present} of {q.required} voting members present
      </span>
    </div>
  );
}
