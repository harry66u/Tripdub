import { expect, test, type Page } from "@playwright/test";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

test.beforeEach(async ({ page }) => {
  // Headshots and logos come from cdn.nba.com; keep tests offline (fallbacks render instead).
  await page.route("https://cdn.nba.com/**", (r) => r.fulfill({ status: 404 }));
  await page.addInitScript(() => localStorage.setItem("tripdub:sf:seen-how-to-v2", "true"));
});

async function spinAndPlace(page: Page, slot: string) {
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.getByRole("button", { name: /^Put .* here$/ }).first().waitFor();
  const name = (await page.locator("article h3").textContent())?.trim();
  await page.locator(`li[data-slot="${slot}"]`).getByRole("button", { name: /^Put .* here$/ }).click();
  await page.getByRole("button", { name: `Lock in at ${slot}` }).click();
  await expect(page.locator("svg[aria-label='Locked']")).toHaveCount(SLOTS.indexOf(slot) + 1);
  return name;
}

const board = (page: Page) => page.getByRole("list", { name: /Your lineup against/ });

async function noHorizontalScroll(page: Page) {
  const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(vw);
}

test("daily: full game with re-spin, reload mid-run, and a saved result", async ({ page }) => {
  await page.goto("/starting-five");
  await expect(page.getByRole("heading", { name: "Starting Five" })).toBeVisible();
  // The opposing five is visible before the first spin.
  await expect(page.getByRole("heading", { name: /^Your five vs the / })).toBeVisible();
  await expect(board(page).locator("li")).toHaveCount(5);
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "Spin", exact: true }).click();
  const first = (await page.locator("article h3").textContent())?.trim();
  await page.getByRole("button", { name: /Re-spin/ }).click();
  await expect(page.locator("article h3")).not.toHaveText(first!);
  await page.locator(`li[data-slot="PG"]`).getByRole("button", { name: /^Put .* here$/ }).click();
  await page.getByRole("button", { name: "Lock in at PG" }).click();
  await spinAndPlace(page, "SG");

  await page.reload();
  await expect(page.getByText("0 re-spins left")).toBeVisible();
  await expect(page.locator("svg[aria-label='Locked']")).toHaveCount(2);

  for (const slot of SLOTS.slice(2)) await spinAndPlace(page, slot);
  await page.getByRole("button", { name: /^Play the / }).click();
  await expect(page.getByText("Win probability", { exact: true })).toBeVisible();
  await expect(page.getByText(/^(Win|Loss)$/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Share result/ })).toBeVisible();
  await noHorizontalScroll(page);

  await page.reload();
  await expect(page.getByText("Win probability", { exact: true })).toBeVisible();
});

test("unlimited: play a game, then play again against a new team", async ({ page }) => {
  await page.goto("/starting-five?mode=unlimited");
  await expect(page.getByRole("tab", { name: "Unlimited" })).toHaveAttribute("aria-selected", "true");
  const firstOpponent = await board(page).innerText();
  for (const slot of SLOTS) await spinAndPlace(page, slot);
  await page.getByRole("button", { name: /^Play the / }).click();
  await expect(page.getByText(/^(Win|Loss)$/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("button", { name: "Spin", exact: true })).toBeVisible();
  await expect(page.locator("svg[aria-label='Locked']")).toHaveCount(0);
  expect(await board(page).innerText()).not.toBe(firstOpponent);
});

test("home lists all three games and opens Starting Five", async ({ page }) => {
  await page.goto("/");
  for (const title of ["Starting Five", "NBA Trivia", "Shot Chart"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await page.getByRole("link", { name: "Play today’s game" }).first().click();
  await expect(page).toHaveURL(/starting-five/);
});
