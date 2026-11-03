import { expect, test } from "@playwright/test";

test("trivia: answer seven questions, see reveals and the results, survive a reload", async ({ page }) => {
  await page.goto("/trivia?mode=unlimited");
  await expect(page.getByRole("heading", { name: "Daily Trivia" })).toBeVisible();
  for (let i = 0; i < 7; i++) {
    await expect(page.getByText(`of 7`).first()).toBeVisible();
    const options = page.locator("section button").filter({ hasText: /^[ABCD]/ });
    await expect(options).toHaveCount(4);
    await options.nth(i % 4).click();
    await expect(page.getByText(/^(Correct!|Not this time\.|Out of time\.)/)).toBeVisible();
    if (i === 2) {
      await page.reload();
      await expect(page.getByText(/^(Correct!|Not this time\.|Out of time\.)/)).toBeVisible();
    }
    await page.getByRole("button", { name: i === 6 ? "See your results" : "Next question" }).click();
  }
  await expect(page.getByText("Final score")).toBeVisible();
  await expect(page.locator("ol li")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /Share result/ })).toBeVisible();
  const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(vw);
});
