import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      // The core is pure and carries the coverage bar. Audio and the scene are
      // verified by ear and eye in the browser.
      include: ["src/core/**/*.js"],
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 90 },
    },
  },
});
