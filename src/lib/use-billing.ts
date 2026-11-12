// The hub's billing for an organization (core get_org_billing): the shell's banner and, from it,
// whether Board is read-only (S-05). null when billing is off (self-hosted). One cached query per
// organization: the shell and the pages share it.
import { useQuery } from "@tanstack/react-query";
import { db } from "@/data";

/** The hub's billing for the banner and read-only (core get_org_billing); null when billing is off. */
export function useBilling(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["billing", orgId],
    enabled: !!orgId,
    queryFn: () => db.billing.get(orgId ?? ""),
  });
}
