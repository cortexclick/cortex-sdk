import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/*.js"],
    setupFiles: ["./test-setup.ts"],
  },
});
