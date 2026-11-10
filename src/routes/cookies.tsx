import { createFileRoute, Link } from "@tanstack/react-router";
import { openCookieSettings } from "@shared/consent";
import { CookieTable } from "@shared/ui/CookieConsent";

// Cookie policy: every cookie the suite sets (shared/consent.ts), so this page, the banner
// and the code use the same list.
export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — OpenBoardApp" },
      {
        name: "description",
        content: "The cookies OpenBoardApp uses, what they're for and how to change your choices.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        OpenBoardApp
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Cookie Policy</h1>
      <p className="mt-3 text-muted-foreground">
        OpenBoardApp uses a few cookies and similar browser storage, all its own. No advertising or
        tracking cookies. Required cookies keep you signed in and remember your organization;
        everything else is off until you allow it.
      </p>
      <div className="mt-6">
        <CookieTable />
      </div>
      <button
        type="button"
        onClick={() => openCookieSettings()}
        className="mt-6 inline-flex rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        Cookie settings
      </button>
    </main>
  );
}
