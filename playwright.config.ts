import { defineConfig } from '@playwright/test';

/**
 * Browser journeys run against the production build (`vite preview`), on a phone with touch and a
 * desktop with a mouse (D-02). On the owner's Mac, Chromium draws with the real GPU (ANGLE on
 * Metal): fast, and close to what players see. GitHub's CI has no GPU, so there it draws through
 * SwiftShader, as in Starman Reborn and Starman Control, and its frame rates say nothing.
 */
const GL_ARGS =
  process.platform === 'darwin'
    ? ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4391',
    trace: 'retain-on-failure',
    launchOptions: { args: GL_ARGS },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4391 --strictPort',
    url: 'http://localhost:4391',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
});
