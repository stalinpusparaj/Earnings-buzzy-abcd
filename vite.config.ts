import { defineConfig } from 'vitest/config';

// base './' keeps every URL relative, so dist/ deploys under any subpath (e.g. /play/).
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 800 },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
