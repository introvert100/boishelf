import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser-ui", timeout: 60000, workers: 1, fullyParallel: false,
  reporter: "list", outputDir: "test-results/ui",
  use: { baseURL: "http://localhost:3001", trace: "retain-on-failure" },
  projects: [{name: "desktop", use: {...devices["Desktop Chrome"]}},
    {name: "mobile", use: {...devices["iPhone 13"], defaultBrowserType: "chromium"}}],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev tests/fixtures/ui --port 3001",
    url: "http://localhost:3001", timeout: 120000, reuseExistingServer: false,
    env: { NEXT_PUBLIC_APP_URL: "http://localhost:3001", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:3001/api/fake-supabase",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public", SUPABASE_SECRET_KEY: "fixture-service",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "fixture-site", ADMIN_EMAIL: "fixture@gmail.com" },
  },
});
