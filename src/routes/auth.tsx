import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { isHosted, loginRedirect, suiteUrls } from "@shared/supabase/hosted";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { attempt, db } from "@/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/export";

// The demo board exists on staging only (db/seed/0001_board_demo.sql), so its sign-in
// is offered only there (VITE_ALLOW_DEMO_LOGIN, set in wrangler.jsonc's staging env)
// and on development servers.
const DEMO_LOGIN =
  import.meta.env.DEV || import.meta.env["VITE_ALLOW_DEMO_LOGIN"] === "true"
    ? { email: "board.demo@demo.openapphub.org", password: "OpenBoardDemo!2026" }
    : null;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {},
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Sign in — OpenBoardApp" },
      { name: "description", content: "Sign in to your organization's board room." },
      { property: "og:title", content: "Sign in — OpenBoardApp" },
      { property: "og:description", content: "Sign in to your organization's board room." },
    ],
  }),
  // Hosted: sign-in, sign-up and password reset are OpenAppHub's (SHARED-SPEC §1.1).
  beforeLoad: () => {
    if (isHosted()) {
      const origin =
        typeof window !== "undefined" ? window.location.origin : (suiteUrls().board ?? "");
      throw redirect({ href: loginRedirect(`${origin}/board`) });
    }
  },
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/board";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/board";
  } catch {
    return "/board";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void db.auth.hasSession().then((yes) => {
      if (yes) navigate({ to: safePath(redirect), replace: true });
    });
    return db.auth.onChange((e, signedIn) => {
      if (e === "SIGNED_IN" && signedIn) navigate({ to: safePath(redirect), replace: true });
    });
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        await db.auth.signIn(email, password);
      } else {
        const { needsConfirmation } = await db.auth.signUp(
          email,
          password,
          name,
          window.location.origin + "/board",
        );
        if (needsConfirmation) setSent(true);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await db.auth.signInWithGoogle(window.location.origin + "/auth");
    if (r.error) toast.error(errorMessage(r.error));
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-xl">
          OpenBoardApp
        </Link>
        <div className="mt-6 rounded-lg border bg-card p-6">
          {sent ? (
            <div>
              <h1 className="text-xl">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to {email}. Open it to finish creating your account.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl">{mode === "in" ? "Sign in" : "Create your account"}</h1>
              <Button variant="outline" className="mt-5 w-full" onClick={google} type="button">
                Continue with Google
              </Button>
              {DEMO_LOGIN ? (
                <Button
                  variant="secondary"
                  className="mt-2 w-full"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await attempt(
                      db.auth.signIn(DEMO_LOGIN.email, DEMO_LOGIN.password),
                    );
                    setBusy(false);
                    if (error) toast.error(errorMessage(error));
                  }}
                >
                  Explore the demo board
                </Button>
              ) : null}
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <form onSubmit={submit} className="space-y-3">
                {mode === "up" && (
                  <div>
                    <Label htmlFor="n">Full name</Label>
                    <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                )}
                <div>
                  <Label htmlFor="e">Email</Label>
                  <Input
                    id="e"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="p">Password</Label>
                  <Input
                    id="p"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "in" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <button
                className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
