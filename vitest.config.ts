import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Runs the whole suite in a time zone that has daylight-saving changes, so the
    // "which day does this belong to" logic is tested against the hard case.
    globalSetup: ["tests/timezone.ts"],
  },
});
