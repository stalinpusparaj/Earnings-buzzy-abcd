import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// base './' keeps every URL relative, so dist/ deploys under any subpath (e.g. /play/).
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/unit/**/*.test.ts'] },
  // Build and test output lives inside the project; don't let the dev server watch or scan it
  // (an e2e run rewrites dist-e2e/index.html, which would reload the page you're playing).
  server: { watch: { ignored: ['**/dist/**', '**/dist-e2e/**', '**/test-results/**', '**/playwright-report/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  plugins: [
    VitePWA({
      // Registered by hand in src/core/offline.ts (an injected inline script would break the CSP).
      injectRegister: false,
      registerType: 'autoUpdate',
      filename: 'sw.js',
      manifest: {
        name: 'Buzzy ABC Garden',
        short_name: 'Buzzy ABC',
        description: 'Learn letters with Buzzy the bee, in English and Tamil.',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#E0F4FF',
        theme_color: '#8ED1FC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the shell only (~250 KB). Models and recorded audio are cached the first
        // time they load, so a first visit never downloads them twice.
        globPatterns: ['**/*.{js,css,html,png,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(models|audio)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'buzzy-packs', expiration: { maxEntries: 120 } },
          },
        ],
      },
    }),
  ],
});
