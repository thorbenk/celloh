import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const executablePath =
  process.env.CHROME_PATH ??
  ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((path) =>
    existsSync(path),
  );
const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL,
    // Omit this option to use Playwright's installed browser on other platforms.
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
});
