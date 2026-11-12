import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO, mainMenu, signIn } from "./helpers";

// The suite demo in Board: Riverside's board room, with three months of meetings, minutes,
// motions, action items, members and terms (db/seed, reset every 12 hours).
const PAGES: { link: string; heading: string }[] = [
  { link: "Overview", heading: "Overview" },
  { link: "Meetings", heading: "Meetings" },
  { link: "Meeting templates", heading: "Meeting templates" },
  { link: "Action items", heading: "Action items" },
  { link: "Documents", heading: "Governance documents" },
  { link: "Members & terms", heading: "Members & terms" },
  { link: "Committees", heading: "Committees" },
  { link: "Audit log", heading: "Audit log" },
];

test.describe("the demo owner", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
  });

  test("opens Riverside's board room with what's coming up", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toContainText(DEMO.org, { ignoreCase: true });
    await expect(main).toContainText(/upcoming meetings/i);
    await expect(main).toContainText("Regular Board Meeting");
  });

  test("every page in the menu opens without an error", async ({ page }) => {
    const menu = mainMenu(page);
    for (const { link, heading } of PAGES) {
      await menu.getByRole("link", { name: link, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading }), link).toBeVisible();
      await expect(
        page.getByRole("alert").filter({ hasText: /error|couldn't|failed/i }),
      ).toHaveCount(0);
    }
  });

  test("meetings: four, each with agenda, attendance, motions and minutes", async ({ page }) => {
    await page.goto("/board/meetings");
    const meetings = page.getByRole("main").locator('a[href*="/board/meetings/"]');
    await expect(meetings).toHaveCount(4);
    await meetings.last().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Regular Board Meeting" }),
    ).toBeVisible();
    for (const tab of [
      "Agenda & notes",
      "Attendance",
      "Motions & votes",
      "Minutes",
      "Action items",
    ])
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Call to order" })).toBeVisible();
    await page.getByRole("tab", { name: "Motions & votes" }).click();
    await expect(page.getByRole("tabpanel")).toContainText(/carried/i);
  });

  test("members and terms list the directors", async ({ page }) => {
    await page.goto("/board/members");
    for (const name of ["Alex Morgan", "Jordan Lee", "Sam Chen", "Priya Patel"])
      await expect(page.getByRole("main").getByText(name).first()).toBeVisible();
  });

  test("action items come from the meetings", async ({ page }) => {
    await page.goto("/board/tasks");
    await expect(page.getByRole("main")).toContainText(/from Regular Board Meeting/);
  });
});

test("the test account has no organization and is asked to set one up", async ({ page }) => {
  await signIn(page, "empty");
  await expect(page.getByRole("heading", { name: "Set up your organization" })).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(DEMO.owner);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/invalid|incorrect|wrong/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/auth/);
});

// The shell's Help link (sidebar or header) opens the docs page for the screen (S-04).
const helpLink = (page: Page, path: string) =>
  page.locator(`a[href="https://docs.openapphub.org/${path}"]`).first();

test("the Help link follows the screen", async ({ page }) => {
  await signIn(page, "owner");
  await expect(helpLink(page, "board/start/overview/")).toBeAttached();
  await mainMenu(page).getByRole("link", { name: "Meetings", exact: true }).click();
  await expect(helpLink(page, "board/meetings/running-a-meeting/")).toBeAttached();
  await mainMenu(page).getByRole("link", { name: "Documents", exact: true }).click();
  await expect(helpLink(page, "board/records/minutes-and-documents/")).toBeAttached();
});

// S-05: answer the hub's billing call with an ended trial, so the app is read-only (nothing on
// staging changes; the database would refuse the writes anyway).
async function asReadOnly(page: Page) {
  await page.route("**/rest/v1/rpc/get_org_billing*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          plan_id: null,
          status: "trialing",
          apps: [],
          trial_ends_at: "2020-01-01T00:00:00Z",
          current_period_end: null,
          cancel_at_period_end: false,
        },
      ]),
    }),
  );
}

test("when the plan makes Board read-only, writing is switched off", async ({ page }) => {
  await asReadOnly(page);
  await signIn(page, "owner");
  await expect(page.getByText(/this app is read-only/).first()).toBeVisible();
  await mainMenu(page).getByRole("link", { name: "Meetings", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New meeting" })).toHaveCount(0);
});

// This round (B-15, in-app explanations, S-25 reminders as automations).
test("the sign-in page has no demo button of its own (OpenAppHub offers the demos)", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo/i })).toHaveCount(0);
});

test("settings explain what quorum and the decision rule mean", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/board/settings");
  await expect(page.getByText(/must be present for the meeting to make decisions/)).toBeVisible();
  await expect(page.getByText(/How many yes votes a motion needs to pass/)).toBeVisible();
  await expect(page.getByText(/72 points is one inch/)).toBeVisible();
});

test("the Email page lists Board's reminders, which owners can change", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/board/email");
  const panel = page.getByRole("region", { name: "Automations" });
  await expect(panel).toBeVisible();
  // Until Board's migration 0009 runs on staging, the panel has nothing to show.
  test.skip(
    await panel.getByText("No automations here yet.").isVisible(),
    "Board 0009 isn't on staging yet",
  );
  await expect(panel.getByText("Meeting reminders")).toBeVisible();
  await expect(panel.getByText("Action item reminders")).toBeVisible();
  await expect(panel.getByLabel(/Days before the meeting/)).toBeEnabled();
});
