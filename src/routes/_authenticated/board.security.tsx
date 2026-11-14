import { createFileRoute } from "@tanstack/react-router";
import { hubUrl, isHosted } from "@shared/supabase/hosted";
import { OrgTwoStepPanel, TwoStepSettings } from "@shared/ui/TwoStep";
import { PageHeader } from "@/components/PageStates";
import { db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { appSaveRecoveryEmail, appSendCode } from "@/lib/security.functions";

// Security (core 0019). Hosted, every security setting lives in OpenAppHub; self-hosted, the
// shared screens are here.
export const Route = createFileRoute("/_authenticated/board/security")({
  head: () => ({ meta: [{ title: "Security · OpenBoardApp" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const { org } = useCurrentOrg();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Settings" title="Security">
        <p className="text-sm text-muted-foreground">
          Two-step sign-in, backup codes and your recovery email.
        </p>
      </PageHeader>
      {isHosted() ? (
        <section className="space-y-3 rounded-lg border bg-card p-5 text-sm">
          <h2 className="text-base font-semibold">Security settings are in OpenAppHub</h2>
          <p className="text-muted-foreground">
            Your account and your organization's security settings cover every OpenAppHub app, so
            they're kept in one place.
          </p>
          <ul className="space-y-2">
            <li>
              <a
                href={hubUrl("/account#two-step")}
                className="font-medium text-primary hover:underline"
              >
                Your account
              </a>
              : two-step sign-in, backup codes, recovery email and recent security activity.
            </li>
            <li>
              <a
                href={hubUrl("/settings#security")}
                className="font-medium text-primary hover:underline"
              >
                Organization settings
              </a>
              : who must use two-step sign-in in {org.name}.
            </li>
          </ul>
        </section>
      ) : (
        <div className="space-y-6">
          <section id="two-step" className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold">Two-step sign-in</h2>
            <TwoStepSettings
              client={db.sharedClient()}
              sendCode={appSendCode}
              saveRecoveryEmail={appSaveRecoveryEmail}
            />
          </section>
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold">{org.name}</h2>
            <OrgTwoStepPanel client={db.sharedClient()} orgId={org.id} />
          </section>
        </div>
      )}
    </div>
  );
}
