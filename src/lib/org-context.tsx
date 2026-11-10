import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/data";
import type { OrgRole } from "./permissions";
import { titleIndex, withTitle } from "./titles";
import { getCurrentOrgCookie, resolveCurrentOrg, setCurrentOrg } from "../../shared/supabase/org";

export interface OrgSummary {
  id: string;
  name: string;
  timezone: string;
  quorum_count: number;
  vote_recording: string;
  vote_close_modes: string[];
  vote_timer_minutes: number | null;
  vote_closer_roles: OrgRole[];
  seconder_required: boolean;
  decision_rule: string;
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
// Earlier versions kept the choice here; read once so it carries over.
const LEGACY_KEY = "board.currentOrg";

function readLegacy(): string | null {
  try {
    return localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

/**
 * The current organization is the suite cookie `oah_org` (SHARED-SPEC §4.1): on
 * .openapphub.org when hosted, so choosing an organization in any app chooses it in
 * all of them. It's a preference, re-checked against the user's memberships below;
 * otherwise the first organization alphabetically.
 */
export function OrgProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [orgId, setOrgIdState] = useState<string | null>(null);
  useEffect(() => {
    setOrgIdState(getCurrentOrgCookie() ?? readLegacy());
  }, []);

  const q = useQuery({
    queryKey: ["my-orgs", userId],
    queryFn: (): Promise<OrgSummary[]> => db.orgs.listMine(userId),
  });

  const value = useMemo<OrgCtx>(() => {
    const orgs = q.data ?? [];
    const org = resolveCurrentOrg(orgs, orgId);
    return {
      userId,
      orgs,
      org,
      loading: q.isLoading,
      refetch: () => void q.refetch(),
      setOrgId: (id) => {
        setCurrentOrg(id);
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
    queryFn: () => db.members.list(orgId),
  });
}

/** Current board titles: label(name, userId) → "Name — Title". */
export function useTitles(orgId: string) {
  const terms = useQuery({ queryKey: ["terms", orgId], queryFn: () => db.terms.list(orgId) });
  return useMemo(() => {
    const idx = titleIndex(terms.data ?? [], new Date().toLocaleDateString("en-CA"));
    return {
      title: idx.title,
      label: (name: string, userId?: string | null) => withTitle(name, idx.title(userId, name)),
    };
  }, [terms.data]);
}
