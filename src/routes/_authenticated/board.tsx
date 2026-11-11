import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@shared/ui/AppShell";
import { hubUrl, isHosted } from "@shared/supabase/hosted";
import { docsUrl } from "@shared/docs";
import { RouterLink } from "@/lib/router-link";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  Users,
  Network,
  LayoutTemplate,
} from "lucide-react";
import { attempt, db } from "@/data";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Board room — OpenBoardApp" },
      {
        name: "description",
        content: "Your organization's meetings, minutes, documents and tasks.",
      },
      { property: "og:title", content: "Board room — OpenBoardApp" },
      {
        property: "og:description",
        content: "Your organization's meetings, minutes, documents and tasks.",
      },
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
  { to: "/board/templates", label: "Meeting templates", icon: LayoutTemplate },
  { to: "/board/tasks", label: "Action items", icon: ListChecks },
  { to: "/board/documents", label: "Documents", icon: FileText },
  { to: "/board/members", label: "Members & terms", icon: Users },
  { to: "/board/committees", label: "Committees", icon: Network },
] as const;

/**
 * Every board page sits in the suite's AppShell (shared/ui, SHARED-SPEC §9): sidebar, top bar
 * with the suite and organization switchers, Help and the user menu (theme, sign out), and the
 * billing banner. Hosted, organizations are created in OpenAppHub.
 */
function Shell() {
  const { orgs, org, setOrgId, loading, userId } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const user = useQuery({
    queryKey: ["auth-user", userId],
    queryFn: () => db.auth.currentUser(),
  });
  // The billing banner (trial, payment problem, read-only); null when billing is off.
  const billing = useQuery({
    queryKey: ["billing", org?.id],
    enabled: !!org,
    queryFn: () => db.billing.get(org?.id ?? ""),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await db.auth.signOut();
    if (isHosted()) window.location.assign(hubUrl("/"));
    else navigate({ to: "/auth", replace: true });
  }

  if (loading)
    return (
      <div className="p-10">
        <LoadingState />
      </div>
    );
  if (!org) return <CreateOrg onSignOut={signOut} />;

  const items = [
    ...nav,
    ...(can(org.role, "audit.read")
      ? [{ to: "/board/audit", label: "Audit log", icon: ScrollText }]
      : []),
  ];
  const isCurrent = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <AppShell
      app="board"
      nav={items.map((n) => ({
        label: n.label,
        href: n.to,
        icon: <n.icon aria-hidden="true" />,
        current: isCurrent(n.to, "exact" in n),
      }))}
      navFooter={[
        {
          label: "Settings & export",
          href: "/board/settings",
          icon: <Settings aria-hidden="true" />,
          current: isCurrent("/board/settings"),
        },
      ]}
      user={user.data ?? null}
      orgs={orgs.map((o) => ({ id: o.id, name: o.name, role: ROLE_LABELS[o.role] }))}
      currentOrgId={org.id}
      onSelectOrg={(id) => setOrgId(id)}
      {...(isHosted() ? { orgCreateHref: hubUrl("/orgs/new") } : {})}
      billing={billing.data ?? null}
      canManageBilling={can(org.role, "org.manage")}
      billingHref={hubUrl("/billing")}
      helpHref={docsUrl("board/")}
      onSignOut={() => void signOut()}
      LinkComponent={RouterLink}
    >
      <Outlet />
    </AppShell>
  );
}

function CreateOrg({ onSignOut }: { onSignOut: () => void }) {
  if (isHosted()) return <CreateOrgInHub onSignOut={onSignOut} />;
  return <CreateOrgHere onSignOut={onSignOut} />;
}

/** Hosted: organizations are created in OpenAppHub, then open here. */
function CreateOrgInHub({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8">
        <p className="eyebrow">Welcome</p>
        <h1 className="mt-2 text-2xl">Set up your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Organizations are created in OpenAppHub, for every app at once. If you were invited, open
          the invitation link instead.
        </p>
        <Button asChild className="mt-5 w-full">
          <a href={hubUrl("/orgs/new")}>Create organization</a>
        </Button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function CreateOrgHere({ onSignOut }: { onSignOut: () => void }) {
  const { refetch, setOrgId } = useOrg();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { data, error } = await attempt(db.orgs.create(name, tz));
    setBusy(false);
    if (error !== null) {
      toast.error(errorMessage(error));
      return;
    }
    setOrgId(data as string);
    refetch();
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={create} className="w-full max-w-md rounded-lg border bg-card p-8">
        <p className="eyebrow">Welcome</p>
        <h1 className="mt-2 text-2xl">Set up your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You'll be the owner. You can invite other board members next. If you were invited, open
          the invitation link instead.
        </p>
        <Label htmlFor="org" className="mt-6 block">
          Organization name
        </Label>
        <Input
          id="org"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={160}
          className="mt-1"
        />
        <Button type="submit" className="mt-5 w-full" disabled={busy}>
          Create organization
        </Button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
