import { defineConfig, devices } from "@playwright/test"

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    trace: "off",
    screenshot: "off",
    video: "off"
  },
  webServer: [
    {
      command: `${npmCommand} run demo:server`,
      cwd: "../server",
      url: "http://127.0.0.1:8000/api/companies",
      timeout: 120000,
      reuseExistingServer: false
    },
    {
      command: `${npmCommand} run dev -- --host 127.0.0.1 --port 5173`,
      url: "http://127.0.0.1:5173",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        VITE_SERVER_URL: "http://127.0.0.1:8000",
        VITE_DEMO_MODE: "true",
        VITE_REDIRECT_URI: "http://127.0.0.1:5173/callback",
        VITE_CLIENT_ID: "demo"
      }
    }
  ]
})
