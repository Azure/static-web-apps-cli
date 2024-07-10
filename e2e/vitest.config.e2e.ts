import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["*.spec.(js|ts)"],
    mockReset: true,
    restoreMocks: true,
    server: {
      deps: {
        inline: ["to-vfile"],
      },
    },
    root: "e2e",
  },
});
