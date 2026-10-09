import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, PageHeader } from "@/components/PageStates";

const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });

describe("every page has a route", () => {
  const pages: [string, string][] = [
    ["/", "/"],
    ["/auth", "/auth"],
    ["/invite/abc123", "/invite/$token"],
    ["/board", "/_authenticated/board/"],
    ["/board/meetings", "/_authenticated/board/meetings/"],
    ["/board/meetings/1234", "/_authenticated/board/meetings/$meetingId"],
    ["/board/templates", "/_authenticated/board/templates"],
    ["/board/tasks", "/_authenticated/board/tasks"],
    ["/board/documents", "/_authenticated/board/documents"],
    ["/board/members", "/_authenticated/board/members"],
    ["/board/committees", "/_authenticated/board/committees"],
    ["/board/audit", "/_authenticated/board/audit"],
    ["/board/settings", "/_authenticated/board/settings"],
  ];
  for (const [path, id] of pages) {
    it(`${path} opens ${id}`, () => {
      expect(router().matchRoutes(path).at(-1)?.routeId).toBe(id);
    });
  }
  it("board pages sit behind the sign-in gate", () => {
    const ids = router().matchRoutes("/board/meetings").map((m) => m.routeId);
    expect(ids).toContain("/_authenticated");
  });
  it("unknown pages fall through to not found", () => {
    expect(router().matchRoutes("/nope/really").at(-1)?.routeId).toBe(rootRouteId);
  });
});

describe("shared page pieces render", () => {
  it("status badges use plain-language labels", () => {
    render(<><StatusBadge status="submitted" /><StatusBadge status="in_progress" /><StatusBadge status="carried" /></>);
    expect(screen.getByText("Awaiting approval")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText("Carried")).toBeTruthy();
  });
  it("error state shows the error message", () => {
    render(<ErrorState error={new Error("Boom")} />);
    expect(screen.getByText("Boom")).toBeTruthy();
  });
  it("empty state and header render their text", () => {
    render(<><PageHeader eyebrow="Org" title="Meetings" /><EmptyState title="Nothing here">Add one</EmptyState></>);
    expect(screen.getByRole("heading", { name: "Meetings" })).toBeTruthy();
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });
});
