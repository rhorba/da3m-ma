import { defineConfig, devices } from "@playwright/test";

// The suite reads CLERK_SECRET_KEY to decide whether the signed-in area can be
// exercised at all. Next loads .env.local itself; the test runner has to be told.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides env directly, and the public suite needs none of it.
}

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  // Runs against a production build: run `pnpm build` first.
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/fr`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
