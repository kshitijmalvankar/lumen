import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-function unit tests only (no DB/network). The `@/` alias mirrors
// tsconfig's paths so tests can import modules the same way app code does.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
