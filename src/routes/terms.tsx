import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { terms } from "@/lib/legal";

const description = "The terms that govern use of OpenBoardApp, operated by OpenAppHub.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Terms of Service — OpenBoardApp" },
      { name: "description", content: description },
      { property: "og:title", content: "Terms of Service — OpenBoardApp" },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <LegalDocument doc={terms} />,
});
