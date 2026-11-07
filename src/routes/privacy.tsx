import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { privacy } from "@/lib/legal";

const description =
  "How OpenBoardApp, operated by OpenAppHub, collects, uses and protects information.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Privacy Policy — OpenBoardApp" },
      { name: "description", content: description },
      { property: "og:title", content: "Privacy Policy — OpenBoardApp" },
      { property: "og:description", content: description },
    ],
  }),
  component: () => <LegalDocument doc={privacy} />,
});
