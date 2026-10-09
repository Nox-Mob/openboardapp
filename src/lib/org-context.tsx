import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgRole } from "./permissions";

export interface OrgSummary {
  id: string;
  name: string;
  timezone: string;
  quorum_count: number;
  role: OrgRole;
}

interface OrgCtx {
  userId: string;
  orgs: OrgSummary[];
  org: OrgSummary | null;
  setOrgId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
}

const Ctx = createContext<OrgCtx | null>(null);
const KEY = "board.currentOrg";

export function OrgProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [orgId, setOrgIdState] = useState<string | null>(null);
  useEffect(() => {
    setOrgIdState(localStorage.getItem(KEY));
  }, []);

  const q = useQuery({
    queryKey: ["my-orgs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("role, organizations(id, name, timezone, quorum_count)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? [])
        .filter((m) => m.organizations)
        .map((m) => ({ ...(m.organizations as Omit<OrgSummary, "role">), role: m.role as OrgRole }));
    },
  });

  const value = useMemo<OrgCtx>(() => {
    const orgs = q.data ?? [];
    const org = orgs.find((o) => o.id === orgId) ?? orgs[0] ?? null;
    return {
      userId,
      orgs,
      org,
      loading: q.isLoading,
      refetch: () => void q.refetch(),
      setOrgId: (id) => {
        localStorage.setItem(KEY, id);
        setOrgIdState(id);
      },
    };
  }, [q.data, q.isLoading, orgId, userId, q]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrg() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOrg must be used inside OrgProvider");
  return c;
}

/** Use inside board pages: the layout guarantees an org exists. */
export function useCurrentOrg() {
  const c = useOrg();
  if (!c.org) throw new Error("No organization selected");
  return { ...c, org: c.org };
}

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      const { data: ms, error } = await supabase.from("memberships").select("id, user_id, role").eq("organization_id", orgId);
      if (error) throw error;
      const ids = (ms ?? []).map((m) => m.user_id);
      const { data: ps } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      return (ms ?? []).map((m) => {
        const p = ps?.find((x) => x.id === m.user_id);
        return { ...m, role: m.role as OrgRole, name: p?.full_name || p?.email || "Member", email: p?.email ?? "" };
      });
    },
  });
}
