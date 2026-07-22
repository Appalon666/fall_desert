import { defineConfig } from 'vite'

// Базовый путь './' важен для Яндекс.Игр — игра грузится из вложенной папки/архива.
export default defineConfig({
  base: './',
  server: {
    host: true,
    open: true,
  },
  build: {
    target: 'es2019',
    assetsInlineLimit: 0,
  },
  // Vitest: логика (data/state/util) не зависит от Phaser → быстрый node-раннер.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
  },
})
