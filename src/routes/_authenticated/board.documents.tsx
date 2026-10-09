import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { nextVersion } from "@/lib/minutes";
import { signedUrl } from "@/lib/meeting-data";
import { PageHeader, LoadingState, EmptyState, ErrorState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "Bylaws",
  "Policies",
  "Financial reports",
  "Meeting materials",
  "Committee reports",
  "General",
];

export const Route = createFileRoute("/_authenticated/board/documents")({
  head: () => ({
    meta: [
      { title: "Governance documents — OpenBoard" },
      { name: "description", content: "Manage private policies, reports and meeting documents." },
      { property: "og:title", content: "Governance documents — OpenBoard" },
      {
        property: "og:description",
        content: "Manage private policies, reports and meeting documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Documents,
});

function Documents() {
  const { org, userId } = useCurrentOrg();
  const qc = useQueryClient();
  const editor = can(org.role, "records.edit");
  const [f, setF] = useState({ title: "", category: "General", meeting_id: "none" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");

  const docs = useQuery({
    queryKey: ["documents", org.id],
    queryFn: () => db.documents.list(org.id),
  });
  const meetings = useQuery({
    queryKey: ["meetings", org.id],
    queryFn: () => db.meetings.list(org.id),
  });

  async function uploadVersion(documentId: string, f: File, existing: { version: number }[]) {
    const version = nextVersion(existing);
    const safe = f.name.replace(/[^\w.-]+/g, "_");
    const path = `${org.id}/documents/${documentId}/v${version}-${safe}`;
    await db.documents.addVersion(
      {
        document_id: documentId,
        organization_id: org.id,
        version,
        storage_path: path,
        file_name: f.name,
        mime_type: f.type,
        size_bytes: f.size,
        uploaded_by: userId,
      },
      f,
      f.type || undefined,
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const id = await db.documents.create({
        title: f.title,
        category: f.category,
        meeting_id: f.meeting_id === "none" ? null : f.meeting_id,
        organization_id: org.id,
        created_by: userId,
      });
      await uploadVersion(id, file, []);
      setF({ title: "", category: "General", meeting_id: "none" });
      setFile(null);
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["documents", org.id] });
      toast.success("Document added");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function newVersion(docId: string, existing: { version: number }[], f: File) {
    try {
      await uploadVersion(docId, f, existing);
      qc.invalidateQueries({ queryKey: ["documents", org.id] });
      toast.success("New version uploaded");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function open(path: string) {
    try {
      window.open(await signedUrl(path), "_blank");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const list = (docs.data ?? []).filter((d) => filter === "all" || d.category === filter);

  return (
    <>
      <PageHeader eyebrow={org.name} title="Governance documents">
        Private to your organization. Download links expire after one minute.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {docs.isLoading ? (
            <LoadingState />
          ) : docs.error ? (
            <ErrorState error={docs.error} />
          ) : !list.length ? (
            <EmptyState title="No documents" />
          ) : (
            list.map((d) => {
              const versions = [...d.document_versions].sort((a, b) => b.version - a.version);
              const mtg = d.meetings as { title: string; meeting_date: string } | null;
              return (
                <div key={d.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="eyebrow">
                        {d.category}
                        {mtg ? ` · ${mtg.title} ${mtg.meeting_date}` : ""}
                      </p>
                      <h3 className="text-base">{d.title}</h3>
                    </div>
                    {editor && (
                      <label className="cursor-pointer text-sm text-primary hover:underline">
                        Upload new version
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            e.target.files?.[0] && newVersion(d.id, versions, e.target.files[0])
                          }
                        />
                      </label>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {versions.map((v, i) => (
                      <li key={v.id} className="flex items-center justify-between">
                        <span>
                          <span className="font-mono text-xs">v{v.version}</span> {v.file_name}{" "}
                          {i === 0 && <span className="text-xs text-success">current</span>}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => open(v.storage_path)}>
                          Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
        {editor && (
          <form onSubmit={create} className="h-fit space-y-3 rounded-lg border bg-card p-5">
            <p className="eyebrow">Add a document</p>
            <div>
              <Label>Title</Label>
              <Input
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meeting (optional)</Label>
              <Select value={f.meeting_id} onValueChange={(v) => setF({ ...f, meeting_id: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not tied to a meeting</SelectItem>
                  {meetings.data?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.meeting_date} {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
