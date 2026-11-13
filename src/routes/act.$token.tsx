import { createFileRoute } from "@tanstack/react-router";
import { isHosted, loginRedirect } from "@shared/supabase/hosted";
import { ActionLinkPage } from "@shared/ui/ActionLink";
import { db } from "@/data";

// A signed link from an email (core 0014, C-08), e.g. Mark it done on an action item: says what it
// will do, then Confirm, signed in as the person it was sent to. Nothing happens on opening it.
export const Route = createFileRoute("/act/$token")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Confirm · OpenBoardApp" }, { name: "robots", content: "noindex" }],
  }),
  component: ActPage,
});

function ActPage() {
  const { token } = Route.useParams();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <ActionLinkPage
        client={db.sharedClient()}
        token={token}
        app="board"
        signInHref={(next) =>
          isHosted() ? loginRedirect(next) : `/auth?redirect=${encodeURIComponent(next)}`
        }
      />
    </main>
  );
}
