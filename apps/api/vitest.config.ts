import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 30000,
    testTimeout: 20000,
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    // Vitest's default "threads" pool has a known Windows-specific worker
    // teardown crash (tinypool `kill EPERM`) after tests finish successfully.
    // "forks" avoids it.
    pool: "forks",
  },
});
