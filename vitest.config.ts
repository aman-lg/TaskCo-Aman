import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
