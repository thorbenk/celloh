import { defineConfig } from '@playwright/test';
import appConfig from './playwright.config';

export default defineConfig({
  testDir: './tests/stories',
  use: { ...appConfig.use, baseURL: 'http://127.0.0.1:6006' },
  webServer: {
    command: 'python3 -m http.server 6006 --bind 127.0.0.1 --directory storybook-static',
    url: 'http://127.0.0.1:6006',
    reuseExistingServer: false,
  },
});
