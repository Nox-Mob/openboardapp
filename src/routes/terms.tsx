import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { terms } from "@/lib/legal";

const description = "The terms that govern use of OpenBoard, operated by OpenAppHub.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Terms of Service — OpenBoard" },
      { name: "description", content: description },
      { property: "og:title", content: "Terms of Service — OpenBoard" },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <LegalDocument doc={terms} />,
});
