import { createFileRoute, redirect } from "@tanstack/react-router";

// No landing page: everyone arrives through OpenAppHub (hosted) or the sign-in page
// (self-hosted). "/" opens the board room; its sign-in check sends signed-out visitors to /auth.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/board" });
  },
});
