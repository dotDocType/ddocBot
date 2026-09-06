import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 20000,
  // Avoid competing browser instances distorting short animation and hover timers.
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [
    { command: 'npm run dev -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
    { command: 'node tools/serve-examples.js', url: 'http://127.0.0.1:4174', reuseExistingServer: true }
  ],
  projects: ['chromium', 'firefox', 'webkit'].map(name => ({name,workers:1,use:{browserName:name}}))
});
