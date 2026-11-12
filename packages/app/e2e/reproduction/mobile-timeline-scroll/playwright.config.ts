import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_MOBILE_SCROLL_PORT ?? 4331)

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../test-results/mobile-timeline-scroll",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: `bun run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: "../../..",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_OPENCTRLC_SERVER_HOST: "127.0.0.1",
      VITE_OPENCTRLC_SERVER_PORT: "4096",
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
      },
    },
  ],
})
