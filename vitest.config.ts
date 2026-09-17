import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 240_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "i18n/routing.ts"],
      exclude: ["lib/**/*.test.ts", "lib/db/schema.ts"],
      reporter: ["text-summary", "text", "json-summary"],
      // Combined unit + integration gate (CTS rule 6); the engine is held to 100% (NFR-4).
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        "lib/engine/**/*.ts": { lines: 100, statements: 100, functions: 100, branches: 100 },
      },
    },
  },
});
