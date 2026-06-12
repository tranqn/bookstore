import { defineConfig, devices } from '@playwright/test';

/** E2E runs against the real production build: SSR server + prerendered
 *  pages + hydration, exactly what Render serves. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4287',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && PORT=4287 node dist/bookstore/server/server.mjs',
    url: 'http://localhost:4287',
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
});
