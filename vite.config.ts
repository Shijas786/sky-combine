import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html', board: 'board.html' } },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
