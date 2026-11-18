import { createFileRoute, Link } from "@tanstack/react-router";
import { AboutLicenses } from "@shared/ui/About";

// About and open-source licenses (SHARED-SPEC §10.3): every open-source library used within the
// suite, by name and license (shared/licenses/suite.json, built by the hub).
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About and open-source licenses — OpenBoardApp" },
      {
        name: "description",
        content: "The open-source libraries used within the OpenAppHub suite, with each license.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        OpenBoardApp
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">About and open-source licenses</h1>
      <div className="mt-6">
        <AboutLicenses />
      </div>
    </main>
  );
}
