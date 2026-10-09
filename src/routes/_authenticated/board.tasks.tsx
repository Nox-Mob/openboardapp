import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org-context";
import { ActionItems } from "@/components/ActionItems";
import { PageHeader } from "@/components/PageStates";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/board/tasks")({
  component: Tasks,
});

function Tasks() {
  const { org } = useCurrentOrg();
  const [view, setView] = useState("mine");
  return (
    <>
      <PageHeader eyebrow={org.name} title="Action items" actions={
        <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="mine">My tasks</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      } />
      <ActionItems key={view} mineOnly={view === "mine"} />
    </>
  );
}
