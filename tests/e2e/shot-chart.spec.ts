import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://cdn.nba.com/**", (r) => r.fulfill({ status: 404 }));
  await page.route("https://ak-static.cms.nba.com/**", (r) => r.fulfill({ status: 404 }));
});

test("shot chart: five rounds with reveals, then results", async ({ page }) => {
  await page.goto("/shot-chart?mode=unlimited");
  await expect(page.getByRole("heading", { name: "Shot Chart" })).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByRole("img", { name: "Shot chart by court zone" })).toBeVisible();
    const choices = page.locator("section button.pop-sm");
    await expect(choices).toHaveCount(4);
    await choices.nth(i % 4).click();
    await expect(page.getByText(/^(Nailed it|Not |Out of time)/)).toBeVisible();
    await page.getByRole("button", { name: i === 4 ? "See your results" : "Next chart" }).click();
  }
  await expect(page.getByText("Final score")).toBeVisible();
  await expect(page.getByRole("button", { name: /Share result/ })).toBeVisible();
  const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(vw);
});
