import { createFileRoute } from "@tanstack/react-router";
import { hubUrl, isHosted } from "@shared/supabase/hosted";
import { AutomationsPanel } from "@shared/ui/Automations";
import { EmailPreferencesPanel, EmailServerPanel } from "@shared/ui/EmailSettings";
import { PageHeader } from "@/components/PageStates";
import { db } from "@/data";
import { useCurrentOrg } from "@/lib/org-context";
import { loadEmailSettings, saveEmailSettings, sendTestEmail } from "@/lib/email.functions";

const BOARD_ONLY = ["board" as const];

export const Route = createFileRoute("/_authenticated/board/email")({
  head: () => ({ meta: [{ title: "Email · OpenBoardApp" }] }),
  component: EmailPage,
});

function EmailPage() {
  const { org, can } = useCurrentOrg();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Settings" title="Email">
        <p className="text-sm text-muted-foreground">
          Meeting reminders and action items that are due.
        </p>
      </PageHeader>
      <div className="space-y-6">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Reminders for {org.name}</h2>
          <AutomationsPanel
            client={db.sharedClient()}
            orgId={org.id}
            canEdit={can("org.manage")}
            apps={BOARD_ONLY}
          />
        </section>
        {isHosted() ? (
          <section className="rounded-lg border bg-card p-5 text-sm">
            <h2 className="text-base font-semibold">Your email</h2>
            <p className="mt-1 text-muted-foreground">
              Choose your reminders and task summary on your OpenAppHub account page; they apply to
              every app.
            </p>
            <a className="mt-3 inline-block underline" href={hubUrl("/account#email")}>
              Open your email choices
            </a>
          </section>
        ) : (
          <>
            <EmailPreferencesPanel client={db.sharedClient()} />
            <EmailServerPanel
              load={() => loadEmailSettings()}
              save={async (data) => {
                await saveEmailSettings({ data });
              }}
              test={() => sendTestEmail()}
            />
          </>
        )}
      </div>
    </div>
  );
}
