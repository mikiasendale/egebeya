/**
 * Vitest configuration — extends vite.config.ts with test-mode knobs.
 *
 * Why a separate file instead of a `test` block in vite.config.ts? Vite's
 * `defineConfig` type union doesn't include the `test` field by default
 * unless it imports from `vitest/config`. A standalone file makes the
 * test configuration discoverable and self-documenting.
 *
 * Notable choices:
 *   - NODE_ENV is forced to 'test' so any code path that branches on
 *     `process.env.NODE_ENV` (e.g. the Chapa SDK behavior in
 *     server/lib/chapa.ts) picks the test/fallback paths consistently
 *     inside CI and on a developer laptop.
 *   - Tests run sequentially (`pool: 'forks', poolOptions.singleFork: true`)
 *     so the in-memory SQLite file doesn't see unrelated concurrent
 *     writes from sibling test files. Each process has its OWN libsql
 *     connection to `file:sqlite.db`, which would otherwise race on the
 *     shared file.
 *   - `--pool=forks` (or threads via the parallel branch) lets us throw
 *     away the process at exit just in case a test leaks DB connections.
 *   - `globals: true` is intentionally OFF — explicit imports keep each
 *     test file self-contained and match the style of the existing
 *     server/tests/ suite.
 *   - `include` is narrowed so any stray `*.test.ts` files dropped into
 *     `src/` aren't silently picked up.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run all test files sequentially: every file shares the same
    // `file:sqlite.db`, and parallel workers writing the same SQLite file
    // cause SQLITE_BUSY flakiness.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      // Required secrets are injected/generated at runtime in
      // server/tests/_setup.ts — never hardcoded here.
    },
    setupFiles: ['./server/tests/_setup.ts'],
  },
});
