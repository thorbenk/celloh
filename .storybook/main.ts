import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/html-vite',
    options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } },
  },
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs'],
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
};

export default config;
