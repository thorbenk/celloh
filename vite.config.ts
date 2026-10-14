import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      // Let an update wait until all app windows close, preserving active practice.
      registerType: 'prompt',
      injectRegister: 'script',
      manifest: {
        id: './',
        name: 'CellOh!',
        short_name: 'CellOh!',
        description: 'Entdecke die Töne und Lagen auf dem Cello-Griffbrett.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#f8f5ef',
        background_color: '#f8f5ef',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,webp,svg,mp3,sf2,txt}'],
        // Include the 4.6 MB SoundFont so both playback engines work offline.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
