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
    // ngsw would swallow route mocks (requests go through the SW fetch
    // handler); E2E targets the app, the SW is covered by manual testing.
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // DISABLE_SEMANTIC: don't download EmbeddingGemma in CI — /api/recommend
    // is always mocked in E2E.
    command:
      'npm run build && DISABLE_SEMANTIC=1 PORT=4287 node dist/bookstore/server/server.mjs',
    url: 'http://localhost:4287',
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
});
