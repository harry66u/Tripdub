import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:3200", reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: "npx next start -p 3200", port: 3200, reuseExistingServer: true, timeout: 60_000 },
});
