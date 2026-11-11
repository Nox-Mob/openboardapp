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
