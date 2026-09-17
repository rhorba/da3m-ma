import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const DB_ACCESS_MESSAGE =
  "Database access is only allowed in lib/*/repository.ts (ADR-5). Call a repository with an Actor instead.";
const MODULE_BOUNDARY_MESSAGE =
  "Import a lib module through its index (e.g. @/lib/cabinet), not its internals (ADR-1).";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "skills/**",
      "drizzle/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/client", "@/lib/db/client", "postgres", "drizzle-orm/postgres-js"],
              message: DB_ACCESS_MESSAGE,
            },
            { group: ["@/lib/*/*", "!@/lib/db/schema"], message: MODULE_BOUNDARY_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    // The only places allowed to touch the database directly.
    files: [
      "lib/*/repository.ts",
      "lib/*/*.repository.ts",
      "lib/db/**",
      "tests/**",
      "scripts/**",
      "drizzle.config.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
