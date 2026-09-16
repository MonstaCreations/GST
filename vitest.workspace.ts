import { defineWorkspace } from 'vitest/config';

// Aggregates tests across the monorepo. Uses inline include globs so empty
// directories don't require a config file.
export default defineWorkspace([
  {
    test: {
      name: 'packages',
      include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
    },
  },
]);
