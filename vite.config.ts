/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Relative base so the build works from any folder (static hosting, Capacitor, file://).
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
