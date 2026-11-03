import { expect, test } from "@playwright/test";

test("deep cut: name players with autocomplete, see tier reveals and the results, survive a reload", async ({ page }) => {
  await page.goto("/deep-cut?mode=unlimited");
  await expect(page.getByRole("heading", { name: "Deep Cut" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  const names = ["LeBron", "Kareem", "Tim Duncan", "Kobe", "Stephen Curry", "Shaq", "Dirk"];
  for (let i = 0; i < 7; i++) {
    await expect(page.getByText(`Prompt ${i + 1} of 7`).first()).toBeAttached();
    const input = page.getByRole("combobox", { name: "Name a player" });
    if (i === 4) {
      await page.getByRole("button", { name: "Pass on this one" }).click();
    } else {
      await input.fill(names[i]);
      await expect(page.getByRole("option").first()).toBeVisible();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByText(/^\+[\d.]+ ft of range$/)).toBeVisible();
    if (i === 2) {
      await page.reload();
      await expect(page.getByText(/^\+[\d.]+ ft of range$/)).toBeVisible();
    }
    await page.getByRole("button", { name: i === 6 ? "See your results" : "Next prompt" }).click();
  }
  await expect(page.getByText("Final range")).toBeVisible();
  await expect(page.locator("ol > li")).toHaveCount(7);
  await expect(page.getByText(/valid answers$/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Share result/ })).toBeVisible();
  const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(vw);
});

test("deep cut: the archive explains itself before there are past days", async ({ page }) => {
  await page.goto("/deep-cut?mode=archive");
  await expect(page.getByRole("tab", { name: "Archive", selected: true })).toBeVisible();
  await expect(page.getByText(/archive opens tomorrow|#\d+/).first()).toBeVisible();
});
