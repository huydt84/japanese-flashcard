import { defineConfig, devices } from "@playwright/test";

const localAuth = process.env.RUN_AUTH_E2E === "1";
const baseURL = localAuth ? "http://127.0.0.1:3110" : "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: localAuth ? 2 : undefined,
  webServer: {
    command: localAuth ? "pnpm run dev:local -- --hostname 127.0.0.1 --port 3110" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !localAuth,
  },
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
  ],
});
