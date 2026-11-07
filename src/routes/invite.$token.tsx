import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { attempt, db } from "@/data";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/export";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Board invitation — OpenBoardApp" },
      { name: "description", content: "Accept an invitation to join a board on OpenBoardApp." },
      { property: "og:title", content: "Board invitation — OpenBoardApp" },
      {
        property: "og:description",
        content: "Accept an invitation to join a board on OpenBoardApp.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void db.auth.hasSession().then(setSignedIn);
  }, []);

  async function accept() {
    setBusy(true);
    const { data, error } = await attempt(db.invitations.accept(token));
    setBusy(false);
    if (error !== null) {
      setError(errorMessage(error));
      return;
    }
    localStorage.setItem("board.currentOrg", data as string);
    navigate({ to: "/board" });
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center">
        <p className="eyebrow">Invitation</p>
        <h1 className="mt-2 text-2xl">You've been invited to join a board</h1>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {signedIn === false && (
          <Button asChild className="mt-6">
            <Link to="/auth" search={{ redirect: `/invite/${token}` }}>
              Sign in to accept
            </Link>
          </Button>
        )}
        {signedIn && (
          <Button className="mt-6" onClick={accept} disabled={busy}>
            Accept invitation
          </Button>
        )}
      </div>
    </div>
  );
}
