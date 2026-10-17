import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests/table-browse/**/*.test.ts', 'tests/search/**/*.test.ts', 'tests/profile/**/*.test.ts', 'tests/auth/**/*.test.tsx'], testTimeout: 5000 },
});
