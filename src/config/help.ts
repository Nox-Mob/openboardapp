// Docs pages linked from OpenBoardApp (S-04, SHARED-SPEC §12.3). The shell's Help link opens
// the page for where you are; every path must exist on docs.openapphub.org.
import { docsUrl, type HelpMap } from "@shared/docs";

export const HELP = {
  home: "board/",
  overview: "board/start/overview/",
  meetings: "board/meetings/running-a-meeting/",
  voting: "board/voting/motions-and-votes/",
  people: "board/people/members-and-terms/",
  records: "board/records/minutes-and-documents/",
  troubleshooting: "board/help/troubleshooting/",
} satisfies HelpMap;

export type HelpKey = keyof typeof HELP;

// Longest prefix first.
const PAGES: [prefix: string, key: HelpKey][] = [
  ["/board/live/", "voting"],
  ["/board/meetings", "meetings"],
  ["/board/templates", "meetings"],
  ["/board/members", "people"],
  ["/board/committees", "people"],
  ["/board/documents", "records"],
  ["/board/audit", "records"],
  ["/board/tasks", "overview"],
  ["/board/settings", "overview"],
  ["/board", "overview"],
];

/** The help page for a location in the app. */
export function helpKeyFor(pathname: string): HelpKey {
  return (
    PAGES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix))?.[1] ?? "home"
  );
}

export function helpHrefFor(pathname: string): string {
  return docsUrl(HELP[helpKeyFor(pathname)]);
}
