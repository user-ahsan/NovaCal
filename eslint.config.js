// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [
      "node_modules",
      ".next",
      "dist",
      "apps/mobile",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
