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
})
