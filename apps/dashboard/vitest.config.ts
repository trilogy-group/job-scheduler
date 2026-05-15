import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
    exclude: ['node_modules', '.next', 'tests/e2e/**/*'],
    coverage: {
      provider: 'v8',
      include: ['src/components/**', 'src/lib/**'],
      exclude: [
        'src/lib/jobs.ts',
        'src/lib/queue.ts',
        'src/lib/supabase-server.ts',
        'src/lib/types.ts',
        'src/components/layout/**',
        'src/components/Sidebar.tsx',
        'src/components/FireworksPayloadPanel.tsx',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
