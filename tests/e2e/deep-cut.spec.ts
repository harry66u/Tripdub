import { expect, test } from "@playwright/test";

test("deep cut: type answers on the court, wrong ones bounce, see reveals and the results, survive a reload", async ({ page }) => {
  await page.goto("/deep-cut?mode=unlimited");
  await expect(page.getByRole("heading", { name: "Deep Cut" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  const input = page.getByRole("textbox", { name: "Name a player" });
  const reveal = page.getByText(/^\+[\d.]+ ft of range$/);
  for (let i = 0; i < 7; i++) {
    await expect(page.getByText(`PROMPT ${i + 1} OF 7`).first()).toBeVisible();
    await expect(input).toBeEnabled({ timeout: 6000 }); // after the read-in
    // Not a player: it bounces and the prompt stays open
    await input.fill("Zzzz Nobody");
    await input.press("Enter");
    await expect(page.getByText("No good. Shoot again.")).toBeVisible();
    await expect(input).toBeEnabled();
    // A star might count; otherwise pass
    await input.fill("LeBron James");
    await input.press("Enter");
    const outcome = await Promise.race([
      reveal.waitFor().then(() => "scored"),
      page.getByText("Zzzz Nobody").first().waitFor().then(async () => {
        await page.waitForTimeout(400);
        return (await reveal.isVisible()) ? "scored" : "pass";
      }),
    ]);
    if (outcome === "pass" && !(await reveal.isVisible())) await page.getByRole("button", { name: "Pass" }).click();
    await expect(reveal).toBeVisible();
    if (i === 2) {
      await page.reload();
      await expect(reveal).toBeVisible();
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
