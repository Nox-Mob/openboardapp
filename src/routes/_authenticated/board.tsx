import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, FileText, LayoutDashboard, ListChecks, LogOut, ScrollText, Settings, Users, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OrgProvider, useOrg } from "@/lib/org-context";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { LoadingState } from "@/components/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Board room — OpenBoard" },
      { name: "description", content: "Your organization's meetings, minutes, documents and tasks." },
      { property: "og:title", content: "Board room — OpenBoard" },
      { property: "og:description", content: "Your organization's meetings, minutes, documents and tasks." },
    ],
  }),
  component: BoardLayout,
});

function BoardLayout() {
  const { user } = Route.useRouteContext();
  return (
    <OrgProvider userId={user.id}>
      <Shell />
    </OrgProvider>
  );
}

const nav = [
  { to: "/board", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/board/meetings", label: "Meetings", icon: CalendarDays },
  { to: "/board/tasks", label: "Action items", icon: ListChecks },
  { to: "/board/documents", label: "Documents", icon: FileText },
  { to: "/board/members", label: "Members & terms", icon: Users },
  { to: "/board/committees", label: "Committees", icon: Network },
] as const;

function Shell() {
  const { orgs, org, setOrgId, loading } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) return <div className="p-10"><LoadingState /></div>;
  if (!org) return <CreateOrg onSignOut={signOut} />;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link to="/" className="font-display text-lg">OpenBoard</Link>
          <select
            aria-label="Organization"
            className="mt-3 w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-sm text-sidebar-accent-foreground"
            value={org.id}
            onChange={(e) => (e.target.value === "__new" ? setOrgId("__new") : setOrgId(e.target.value))}
          >
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-sidebar-foreground/60">{ROLE_LABELS[org.role]}</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          {can(org.role, "audit.read") && (
            <Link to="/board/audit" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
              <ScrollText className="h-4 w-4" /> Audit log
            </Link>
          )}
          <Link to="/board/settings" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
            <Settings className="h-4 w-4" /> Settings & export
          </Link>
        </nav>
        <button onClick={signOut} className="flex items-center gap-3 border-t border-sidebar-border px-6 py-4 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <div className="flex-1">
        <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <span className="font-display">{org.name}</span>
          <button onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="whitespace-nowrap rounded px-3 py-1.5 text-xs" activeProps={{ className: "bg-primary text-primary-foreground" }}>{n.label}</Link>
          ))}
          <Link to="/board/settings" className="whitespace-nowrap rounded px-3 py-1.5 text-xs" activeProps={{ className: "bg-primary text-primary-foreground" }}>Settings</Link>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CreateOrg({ onSignOut }: { onSignOut: () => void }) {
  const { refetch, setOrgId } = useOrg();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { data, error } = await supabase.rpc("create_organization", { _name: name, _timezone: tz });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    setOrgId(data as string);
    refetch();
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={create} className="w-full max-w-md rounded-lg border bg-card p-8">
        <p className="eyebrow">Welcome</p>
        <h1 className="mt-2 text-2xl">Set up your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">You'll be the owner. You can invite other board members next. If you were invited, open the invitation link instead.</p>
        <Label htmlFor="org" className="mt-6 block">Organization name</Label>
        <Input id="org" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} className="mt-1" />
        <Button type="submit" className="mt-5 w-full" disabled={busy}>Create organization</Button>
        <button type="button" onClick={onSignOut} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">Sign out</button>
      </form>
    </div>
  );
}
