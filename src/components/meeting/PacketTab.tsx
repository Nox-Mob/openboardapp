import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";

import { errorMessage } from "@/lib/export";
import { buildPacket } from "@/lib/packet";
import { loadLetterhead } from "@/lib/load-letterhead";
import { nextVersion } from "@/lib/minutes";
import { currentHolder } from "@/lib/titles";
import { useAgenda, signedUrl } from "@/lib/meeting-data";
import type { Tables } from "@/integrations/supabase/types";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export function PacketTab({ meeting }: { meeting: Tables<"meetings"> }) {
  const { org, userId, can } = useCurrentOrg();
  const qc = useQueryClient();
  const agenda = useAgenda(meeting.id);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const editor = can("records.edit");

  const docs = useQuery({
    queryKey: ["packet-docs", org.id],
    queryFn: () => db.documents.list(org.id),
  });
  const roles = useQuery({
    queryKey: ["positions", org.id],
    queryFn: () => db.positions.list(org.id),
  });
  const terms = useQuery({ queryKey: ["terms", org.id], queryFn: () => db.terms.list(org.id) });
  const packets = useQuery({
    queryKey: ["packets", meeting.id],
    queryFn: () => db.packets.list(meeting.id),
  });

  const latest = (d: NonNullable<typeof docs.data>[number]) =>
    [...d.document_versions].sort((a, b) => b.version - a.version)[0];

  async function generate() {
    setBusy(true);
    try {
      const selectedDocs = (docs.data ?? []).filter((d) => chosen.has(d.id) && latest(d));
      const attachments = await Promise.all(
        selectedDocs.map(async (d) => {
          const v = latest(d)!;
          const isPdf =
            v.mime_type === "application/pdf" || v.file_name.toLowerCase().endsWith(".pdf");
          const bytes = isPdf
            ? await (await fetch(await signedUrl(v.storage_path))).arrayBuffer()
            : null;
          return {
            title: d.title,
            fileName: `${v.file_name} v${v.version}`,
            bytes,
            ref: { document_id: d.id, version: v.version, title: d.title },
          };
        }),
      );
      const agendaText = (agenda.data ?? [])
        .map((a, i) => `${i + 1}. ${a.title}${a.presenter ? " - " + a.presenter : ""}`)
        .join("\n");
      const roster = (roles.data ?? [])
        .map(
          (r) =>
            `${r.title}: ${currentHolder(terms.data ?? [], r.id, meeting.meeting_date)?.person_name ?? "Vacant"}`,
        )
        .join("\n");
      const version = nextVersion(packets.data ?? []);
      const pdf = await buildPacket({
        title: `${org.name} - ${meeting.title} - ${meeting.meeting_date} (Packet v${version})`,
        agendaText: (roster ? "Board roster\n" + roster + "\n\n" : "") + "Agenda\n" + agendaText,
        attachments,
        letterhead: await loadLetterhead(org.id),
      });
      const path = `${org.id}/packets/${meeting.id}/v${version}.pdf`;
      await db.packets.create(
        {
          org_id: org.id,
          meeting_id: meeting.id,
          version,
          storage_path: path,
          contents: attachments.map((a) => a.ref),
          created_by: userId,
        },
        new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }),
      );
      qc.invalidateQueries({ queryKey: ["packets", meeting.id] });
      toast.success(`Packet v${version} generated`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function distribute(id: string) {
    const { error } = await attempt(db.packets.distribute(id));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    qc.invalidateQueries({ queryKey: ["packets", meeting.id] });
  }

  async function open(path: string) {
    try {
      window.open(await signedUrl(path), "_blank");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (docs.isLoading || packets.isLoading) return <LoadingState />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {editor && (
        <section className="rounded-lg border bg-card p-5">
          <p className="eyebrow">Assemble packet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The agenda goes first, then the latest version of each selected PDF. Upload files in
            Documents.
          </p>
          <div className="mt-4 space-y-2">
            {!docs.data?.length && (
              <p className="text-sm text-muted-foreground">No documents in the library yet.</p>
            )}
            {docs.data?.filter(latest).map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={chosen.has(d.id)}
                  onCheckedChange={(c) => {
                    const n = new Set(chosen);
                    if (c) n.add(d.id);
                    else n.delete(d.id);
                    setChosen(n);
                  }}
                />
                <span className="flex-1">{d.title}</span>
                {d.meeting_id === meeting.id && <Badge variant="secondary">This meeting</Badge>}
                <span className="font-mono text-xs text-muted-foreground">
                  v{latest(d)!.version}
                </span>
              </label>
            ))}
          </div>
          <Button className="mt-4" onClick={generate} disabled={busy}>
            {busy ? "Building PDF…" : "Generate packet PDF"}
          </Button>
        </section>
      )}
      <section className="space-y-3">
        <p className="eyebrow">Packet versions</p>
        <p className="text-xs text-muted-foreground">
          Each PDF you build is kept as a new version. &ldquo;Mark as distributed&rdquo; records
          that you sent it to the board (by email or on paper); it doesn&apos;t send anything
          itself.
        </p>
        {!packets.data?.length ? (
          <EmptyState title="No packets generated" />
        ) : (
          packets.data.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">Packet v{p.version}</span>
                {p.distributed_at ? (
                  <Badge>Distributed {new Date(p.distributed_at).toLocaleDateString()}</Badge>
                ) : (
                  <Badge variant="outline">Not distributed</Badge>
                )}
              </div>
              <ul className="mt-2 text-xs text-muted-foreground">
                {(p.contents as { title: string; version: number }[]).map((c, i) => (
                  <li key={i}>
                    {c.title} (v{c.version})
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => open(p.storage_path)}>
                  Download
                </Button>
                {editor && !p.distributed_at && (
                  <Button size="sm" onClick={() => distribute(p.id)}>
                    Mark as distributed
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
