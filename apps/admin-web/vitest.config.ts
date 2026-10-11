import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/table-browse/**/*.test.ts'], testTimeout: 5000 } });
