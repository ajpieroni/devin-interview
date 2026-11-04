import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { DATABASE_URL: "file:./test.db", IDP: "dev", NODE_ENV: "test" },
  },
});
