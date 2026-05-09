import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/apps/mobile/**"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@novacal/shared": path.resolve(__dirname, "packages/shared"),
      "@novacal/db": path.resolve(__dirname, "packages/db"),
      "@novacal/db/schema": path.resolve(__dirname, "packages/db/schema"),
      "@novacal/auth": path.resolve(__dirname, "packages/auth"),
      "@novacal/ui": path.resolve(__dirname, "packages/ui"),
    },
  },
});
