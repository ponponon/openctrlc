import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_SESSION_SEARCH_BAR_PORT ?? 4321)

export default defineConfig({
  testDir: ".",
  testMatch: "session-search-bar.spec.ts",
  outputDir: "../../test-results/session-search-bar",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: `bunx vite --config vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: import.meta.dirname,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
  ],
})
