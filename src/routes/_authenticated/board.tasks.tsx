import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org-context";
import { ActionItems } from "@/components/ActionItems";
import { PageHeader } from "@/components/PageStates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/board/tasks")({
  head: () => ({
    meta: [
      { title: "Action items — OpenBoardApp" },
      { name: "description", content: "Track board assignments and follow-up tasks." },
      { property: "og:title", content: "Action items — OpenBoardApp" },
      { property: "og:description", content: "Track board assignments and follow-up tasks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tasks,
});

function Tasks() {
  const { org } = useCurrentOrg();
  const [view, setView] = useState("mine");
  // The tabs and the list share one Tabs, so each tab points at the list it shows.
  return (
    <Tabs value={view} onValueChange={setView}>
      <PageHeader
        eyebrow={org.name}
        title="Action items"
        actions={
          <TabsList>
            <TabsTrigger value="mine">My tasks</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="mine">
        <ActionItems mineOnly />
      </TabsContent>
      <TabsContent value="all">
        <ActionItems mineOnly={false} />
      </TabsContent>
    </Tabs>
  );
}
