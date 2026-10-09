import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
  submitted: "Awaiting approval",
  approved: "Approved",
  superseded: "Superseded",
  carried: "Carried",
  failed: "Failed",
  tabled: "Tabled",
  withdrawn: "Withdrawn",
  pending: "Pending",
  open: "Open",
  done: "Done",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved" || status === "carried" || status === "done" || status === "completed"
      ? "default"
      : status === "failed" || status === "cancelled"
        ? "destructive"
        : status === "archived" || status === "superseded"
          ? "outline"
          : "secondary";
  return <Badge variant={variant}>{LABELS[status] ?? status}</Badge>;
}
