import { hubUrl, isHosted } from "@shared/supabase/hosted";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Copy } from "lucide-react";
import { attempt, db } from "@/data";
import { useCurrentOrg, useOrgMembers, useTitles } from "@/lib/org-context";
import { can, ROLES, ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { errorMessage } from "@/lib/export";
import { currentHolder, termEnd } from "@/lib/titles";
import type { Tables } from "@/integrations/supabase/types";
import { PageHeader, LoadingState, EmptyState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/board/members")({
  head: () => ({
    meta: [
      { title: "Members & terms — OpenBoardApp" },
      { name: "description", content: "Manage app access, board roles and terms of service." },
      { property: "og:title", content: "Members & terms — OpenBoardApp" },
      {
        property: "og:description",
        content: "Manage app access, board roles and terms of service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Members,
});

const INVITABLE = ROLES.filter((r) => r !== "owner");
const TERM_OPTIONS = [1, 2, 3, 4, 5];

function TermSelect({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ? String(value) : "none"}
      onValueChange={(v) => onChange(v === "none" ? null : Number(v))}
      disabled={!!disabled}
    >
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TERM_OPTIONS.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y} year{y > 1 ? "s" : ""}
          </SelectItem>
        ))}
        <SelectItem value="none">No fixed term</SelectItem>
      </SelectContent>
    </Select>
  );
}

type Candidate = { user_id: string; name: string };

function RoleCard({
  role,
  terms,
  today,
  editor,
  candidates,
  orgId,
}: {
  role: Tables<"positions">;
  terms: Tables<"terms">[];
  today: string;
  editor: boolean;
  candidates: Candidate[];
  orgId: string;
}) {
  const qc = useQueryClient();
  const holder = currentHolder(terms, role.id, today);
  const history = terms
    .filter((t) => t.id !== holder?.id)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const [filling, setFilling] = useState(false);
  const [who, setWho] = useState("");
  const [start, setStart] = useState(today);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["terms", orgId] });
    qc.invalidateQueries({ queryKey: ["positions", orgId] });
  };

  async function fill(e: React.FormEvent) {
    e.preventDefault();
    const c = candidates.find((x) => x.user_id === who);
    if (!c) return;
    const { error } = await attempt(
      db.terms.assign({
        org_id: orgId,
        position_id: role.id,
        position: role.title,
        person_name: c.name,
        user_id: c.user_id,
        start_date: start,
        end_date: termEnd(start, role.term_years),
      }),
    );
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    toast.success(`${c.name} is now ${role.title}`);
    setFilling(false);
    setWho("");
    refresh();
  }
  async function setYears(v: number | null) {
    const { error } = await attempt(db.positions.update(role.id, { term_years: v }));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  }
  async function removeRole() {
    if (!confirm(`Delete the role "${role.title}"? Past terms are kept.`)) return;
    const { error } = await attempt(db.positions.remove(role.id));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    refresh();
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg">{role.title}</h3>
          <p className="text-sm">
            {holder ? (
              <>
                <span className="font-medium">{holder.person_name}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {holder.start_date} → {holder.end_date ?? "present"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Vacant</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editor ? (
            <TermSelect value={role.term_years} onChange={setYears} />
          ) : (
            <Badge variant="secondary">
              {role.term_years ? `${role.term_years}-year term` : "No fixed term"}
            </Badge>
          )}
          {editor && (
            <Button size="sm" onClick={() => setFilling(!filling)}>
              {holder ? "Change who fills it" : "Fill role"}
            </Button>
          )}
          {editor && (
            <Button
              size="icon"
              variant="ghost"
              onClick={removeRole}
              aria-label={`Delete ${role.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {filling && (
        <form
          onSubmit={fill}
          className="mt-3 grid gap-2 rounded-md bg-muted p-3 md:grid-cols-[1fr_160px_auto]"
        >
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger aria-label="Who fills this role">
              <SelectValue placeholder="Choose a board member…" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            aria-label="Term starts"
          />
          <Button type="submit" disabled={!who}>
            Save
          </Button>
          <p className="text-xs text-muted-foreground md:col-span-3">
            Term {start} → {termEnd(start, role.term_years) ?? "no end date"}.
            {holder
              ? ` ${holder.person_name}'s term ends the day before; it stays in the history.`
              : ""}{" "}
            Only people with app access appear here — invite them first.
          </p>
        </form>
      )}
      {!!history.length && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            History ({history.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {history.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>{t.person_name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t.start_date} → {t.end_date ?? "present"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Members() {
  const { org, userId } = useCurrentOrg();
  const qc = useQueryClient();
  const members = useOrgMembers(org.id);
  const manager = can(org.role, "org.manage");
  const editor = can(org.role, "records.edit");
  const [inv, setInv] = useState({ email: "", role: "member" as OrgRole });
  const [link, setLink] = useState<string | null>(null);
  const [role, setRole] = useState({ title: "", term_years: 1 as number | null });
  const today = new Date().toLocaleDateString("en-CA");
  const titles = useTitles(org.id);

  const invites = useQuery({
    enabled: manager,
    queryKey: ["invites", org.id],
    queryFn: () => db.invitations.listOpen(org.id),
  });
  const terms = useQuery({
    queryKey: ["terms", org.id],
    queryFn: () => db.terms.list(org.id),
  });
  const positions = useQuery({
    queryKey: ["positions", org.id],
    queryFn: () => db.positions.list(org.id),
  });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await attempt(db.invitations.create(org.id, inv.email, inv.role));
    if (error !== null) {
      toast.error(errorMessage(error));
      return;
    }
    setLink(`${window.location.origin}/invite/${data}`);
    setInv({ email: "", role: "member" });
    qc.invalidateQueries({ queryKey: ["invites", org.id] });
  }

  async function changeRole(id: string, role: OrgRole) {
    const { error } = await attempt(db.members.setRole(org.id, id, role));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    qc.invalidateQueries({ queryKey: ["org-members", org.id] });
  }
  async function removeMember(id: string) {
    if (!confirm("Remove this person from the organization?")) return;
    const { error } = await attempt(db.members.remove(org.id, id));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    qc.invalidateQueries({ queryKey: ["org-members", org.id] });
  }
  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await attempt(
      db.positions.add({
        org_id: org.id,
        title: role.title.trim(),
        term_years: role.term_years,
        sort_order: positions.data?.length ?? 0,
      }),
    );
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setRole({ title: "", term_years: 1 });
    qc.invalidateQueries({ queryKey: ["positions", org.id] });
  }
  async function deleteTerm(id: string) {
    const { error } = await attempt(db.terms.remove(id));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    qc.invalidateQueries({ queryKey: ["terms", org.id] });
  }
  async function revoke(id: string) {
    await attempt(db.invitations.revoke(id));
    qc.invalidateQueries({ queryKey: ["invites", org.id] });
  }

  const unlinked = (terms.data ?? []).filter((t) => !t.position_id);

  return (
    <>
      <PageHeader eyebrow={org.name} title="Members & terms" />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <p className="eyebrow mb-2">App access</p>
          {members.isLoading ? (
            <LoadingState />
          ) : (
            <div className="divide-y rounded-lg border bg-card">
              {members.data?.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {m.name}
                      {m.user_id === userId && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {titles.title(m.user_id, m.name) ? (
                        <span className="font-medium text-primary">
                          {titles.title(m.user_id, m.name)} ·{" "}
                        </span>
                      ) : null}
                      {m.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {manager && m.role !== "owner" ? (
                      <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as OrgRole)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVITABLE.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
                    )}
                    {manager && m.role !== "owner" && m.user_id !== userId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMember(m.id)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {manager && (
          <section className="space-y-3">
            {isHosted() ? (
              <div className="space-y-2 rounded-lg border bg-card p-5">
                <p className="eyebrow">Invite someone</p>
                <p className="text-sm text-muted-foreground">
                  Invitations are sent from OpenAppHub, for every app at once. An office (chair,
                  secretary, treasurer) is set here once they've joined.
                </p>
                <a
                  href={hubUrl("/members")}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Members and invitations
                </a>
              </div>
            ) : (
              <form onSubmit={invite} className="space-y-3 rounded-lg border bg-card p-5">
                <p className="eyebrow">Invite someone</p>
                <div>
                  <Label>Email (for your records)</Label>
                  <Input
                    type="email"
                    value={inv.email}
                    onChange={(e) => setInv({ ...inv, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={inv.role}
                    onValueChange={(v) => setInv({ ...inv, role: v as OrgRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Create invite link
                </Button>
                {link && (
                  <div className="rounded-md bg-muted p-3 text-xs">
                    <p className="mb-1 font-medium">Send this link (valid 14 days, single use):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all">{link}</code>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}
            {!!invites.data?.length && (
              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="eyebrow mb-2">Pending invites</p>
                {invites.data.map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-1">
                    <span>
                      {i.email || "Link"} · {ROLE_LABELS[i.role as OrgRole]}
                    </span>
                    <button className="text-xs text-destructive" onClick={() => revoke(i.id)}>
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <section className="mt-10">
        <p className="eyebrow mb-2">Board roles & terms</p>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {positions.isLoading ? (
              <LoadingState />
            ) : !positions.data?.length ? (
              <EmptyState title="No board roles yet" />
            ) : (
              positions.data.map((p) => (
                <RoleCard
                  key={p.id}
                  role={p}
                  terms={(terms.data ?? []).filter((t) => t.position_id === p.id)}
                  today={today}
                  editor={editor}
                  candidates={(members.data ?? []).filter((m) => m.role !== "observer")}
                  orgId={org.id}
                />
              ))
            )}
            {!!unlinked.length && (
              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="eyebrow mb-2">Older terms not tied to a role</p>
                {unlinked.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1">
                    <span>
                      {t.person_name} · {t.position}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      {t.start_date} → {t.end_date ?? "present"}
                      {editor && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTerm(t.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {editor && (
            <form onSubmit={addRole} className="h-fit space-y-3 rounded-lg border bg-card p-5">
              <p className="eyebrow">Create a board role</p>
              <div>
                <Label>Title</Label>
                <Input
                  value={role.title}
                  onChange={(e) => setRole({ ...role, title: e.target.value })}
                  placeholder="President, Membership VP…"
                  required
                />
              </div>
              <div>
                <Label>Term length</Label>
                <TermSelect
                  value={role.term_years}
                  onChange={(v) => setRole({ ...role, term_years: v })}
                />
              </div>
              <Button type="submit" className="w-full">
                Add role
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
