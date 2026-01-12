import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'node_modules/',
      'admin-panel/**', // Playwright tests - run separately
      'temp/**', // Temporary files
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'admin-panel/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
});
