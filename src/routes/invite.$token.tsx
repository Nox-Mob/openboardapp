import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/export";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Board invitation — OpenBoard" },
      { name: "description", content: "Accept an invitation to join a board on OpenBoard." },
      { property: "og:title", content: "Board invitation — OpenBoard" },
      { property: "og:description", content: "Accept an invitation to join a board on OpenBoard." },
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
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  async function accept() {
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
    setBusy(false);
    if (error) return setError(errorMessage(error));
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
          <Button asChild className="mt-6"><Link to="/auth" search={{ redirect: `/invite/${token}` }}>Sign in to accept</Link></Button>
        )}
        {signedIn && <Button className="mt-6" onClick={accept} disabled={busy}>Accept invitation</Button>}
      </div>
    </div>
  );
}
