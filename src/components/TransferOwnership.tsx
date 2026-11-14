import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReauthDialog } from "@shared/ui/Reauth";
import { appSendCode } from "@/lib/security.functions";
import { attempt, authClient, db } from "@/data";
import { errorMessage } from "@/lib/export";
import { useCurrentOrg } from "@/lib/org-context";
import { confirmationMatches } from "@/lib/ownership";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Two-step ownership transfer: pick an active member, then confirm by typing their name.
 * The database (transfer_ownership) re-checks owner, membership, active account and the
 * typed name, so nothing here is the security boundary.
 */
export function TransferOwnership() {
  const { org, can } = useCurrentOrg();
  const owner = can("ownership.transfer");
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  // After the typed name, "Confirm it's you" (core 0019) makes a one-time pass for the transfer.
  const [confirming, setConfirming] = useState(false);

  const candidates = useQuery({
    queryKey: ["ownership-candidates", org.id],
    queryFn: () => db.orgs.transferCandidates(org.id),
    enabled: owner,
    // A refusal here is a permission answer, not a network blip: don't retry it.
    retry: false,
  });
  const target = candidates.data?.find((c) => c.user_id === selected);
  const ready = !!target && confirmationMatches(typed, target.confirm_text);

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
  }

  function transfer() {
    if (!target || !ready) return;
    setOpen(false);
    setConfirming(true);
  }

  async function transferWith(reauth: string) {
    if (!target) return;
    setBusy(true);
    const { error } = await attempt(db.orgs.transferOwnership(org.id, target.user_id, reauth));
    setBusy(false);
    if (error) throw new Error(errorMessage(error));
    setConfirming(false);
    setTyped("");
    setSelected("");
    toast.success(`${target.confirm_text} is now the owner. You are an administrator.`);
    // Reload memberships first, so this page sees the caller as an administrator
    // (and stops asking for candidates), then drop the owner-only candidate list.
    await qc.invalidateQueries({ queryKey: ["my-orgs"] });
    qc.removeQueries({ queryKey: ["ownership-candidates", org.id] });
    void qc.invalidateQueries({ queryKey: ["org-members", org.id] });
  }

  return (
    <section className="space-y-3 rounded-lg border border-destructive/40 bg-card p-5">
      <p className="eyebrow text-destructive">Transfer ownership</p>
      {!owner ? (
        <p className="text-sm text-muted-foreground">
          Only the organization&apos;s owner can transfer ownership.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Hand this organization to another active member. They become the owner and you become an
            administrator. Only the new owner can transfer it again. Every organization has exactly
            one owner.
          </p>
          {candidates.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : candidates.isError ? (
            <p className="text-sm text-destructive">{errorMessage(candidates.error)}</p>
          ) : !candidates.data?.length ? (
            <p className="text-sm text-muted-foreground">
              No other active members yet. Invite someone first; they must have confirmed their
              email address.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="new-owner">New owner (active members only)</Label>
                <select
                  id="new-owner"
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Choose a member…</option>
                  {candidates.data.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name ?? c.email} — {ROLE_LABELS[c.role]} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={!target}
                onClick={() => setOpen(true)}
              >
                TRANSFER OWNERSHIP
              </Button>
            </>
          )}
        </>
      )}

      <AlertDialog open={open} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership of {org.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{target?.confirm_text}</strong> will become the owner. You will become an
                  administrator and can&apos;t undo this yourself; only the new owner can transfer
                  ownership back.
                </p>
                <p>
                  To confirm, type <strong>{target?.confirm_text}</strong> below.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="Type the new owner's name to confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void transfer();
              }
            }}
            placeholder={target?.confirm_text}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!ready || busy}
              onClick={() => void transfer()}
            >
              Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReauthDialog
        client={authClient as unknown as SupabaseClient}
        action="transfer_ownership"
        open={confirming}
        title={`Transfer ownership of ${org.name}?`}
        description={`${target?.confirm_text ?? "The member you chose"} will become the owner, and you'll become an administrator.`}
        confirmLabel="Transfer ownership"
        sendCode={appSendCode}
        onConfirmed={transferWith}
        onClose={() => {
          setConfirming(false);
          setTyped("");
        }}
      />
    </section>
  );
}
