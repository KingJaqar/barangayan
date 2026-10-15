import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/table-browse/**/*.test.ts', 'tests/search/**/*.test.ts', 'tests/profile/**/*.test.ts'], testTimeout: 5000 } });
