import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Vitest's default "threads" pool has a known Windows-specific worker
    // teardown crash (tinypool `kill EPERM`) after tests finish successfully.
    // "forks" avoids it — see apps/api/vitest.config.ts for the same fix.
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
