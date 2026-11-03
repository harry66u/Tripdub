import { expect, test, type Page } from "@playwright/test";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

test.beforeEach(async ({ page }) => {
  // Headshots come from cdn.nba.com; keep tests offline (initials fallback renders instead).
  await page.route("https://cdn.nba.com/**", (r) => r.fulfill({ status: 404 }));
  await page.addInitScript(() => localStorage.setItem("tripdub:sf:seen-how-to", "true"));
});

async function spinAndPlace(page: Page, slot: string) {
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.getByRole("button", { name: /^Put .* here$/ }).first().waitFor();
  const name = (await page.locator("article h3").textContent())?.trim();
  await page.locator(`li:has(span:text-is("${slot}")) >> role=button[name=/^Put .* here$/]`).click();
  await page.getByRole("button", { name: `Lock in at ${slot}` }).click();
  await expect(page.locator("li", { hasText: name! }).first()).toBeVisible();
}

test("plays a full daily game, survives a reload, and shows the result", async ({ page }) => {
  await page.goto("/starting-five");
  await expect(page.getByRole("heading", { name: "Starting Five" })).toBeVisible();

  // Use the re-spin on the first player.
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  const first = (await page.locator("article h3").textContent())?.trim();
  await page.getByRole("button", { name: /Re-spin/ }).click();
  await expect(page.locator("article h3")).not.toHaveText(first!);
  await page.locator(`li:has(span:text-is("PG")) >> role=button[name=/^Put .* here$/]`).click();
  await page.getByRole("button", { name: "Lock in at PG" }).click();

  await spinAndPlace(page, "SG");

  // Reload mid-run: same lineup, re-spin still used.
  await page.reload();
  await expect(page.getByText("0 re-spins left")).toBeVisible();
  await expect(page.locator("svg[aria-label='Locked']")).toHaveCount(2);

  for (const slot of SLOTS.slice(2)) await spinAndPlace(page, slot);

  await page.getByRole("button", { name: "Play the Mystery Five" }).click();
  await expect(page.getByText("Win probability", { exact: true })).toBeVisible();
  await expect(page.getByText(/^(Win|Loss)$/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Share result/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Box score" })).toBeVisible();

  const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(vw);

  // Result persists for the day.
  await page.reload();
  await expect(page.getByText("Win probability", { exact: true })).toBeVisible();
});

test("home links to the game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Starting Five/ }).click();
  await expect(page).toHaveURL(/starting-five/);
});
