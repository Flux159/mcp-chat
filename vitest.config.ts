import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Set timeout to 120 seconds for all tests
    testTimeout: 120000,
    exclude: ["dist/**/*", "node_modules/**/*"],
  },
});
