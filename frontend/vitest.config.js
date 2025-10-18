import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.js'],
    threads: false,
    include: ['tests/**/*.spec.{js,jsx}'], // Include unit, integration, and perf tests
    reporters: ['default', 'json'],
    outputFile: './tests/test-results.json',
    coverage: {
      reporter: ['text', 'html'],
    },
    passWithNoTests: true,
  },
});
