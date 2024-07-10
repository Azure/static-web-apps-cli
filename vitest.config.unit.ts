import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
    mockReset: true,
    restoreMocks: true,
    server: {
      deps: {
        inline: ["to-vfile"],
      },
    },
  },
});
