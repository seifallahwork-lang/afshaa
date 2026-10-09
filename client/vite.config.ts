import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    // Older phones and browsers get a second, translated build with polyfills;
    // modern browsers keep the small, fast one.
    legacy({
      targets: ["defaults", "chrome >= 64", "safari >= 12", "firefox >= 68", "samsung >= 9", "opera >= 50", "android >= 7", "ios >= 12"],
      modernPolyfills: true,
    }),
  ],
  build: {
    // Keep direction-aware CSS (RTL/LTR) as written; older browsers get a slightly simpler layout.
    cssTarget: ["chrome87", "safari14.1", "firefox78", "edge88"],
  },
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true, // reachable from phones on your Wi-Fi for local testing
    fs: { allow: [".."] },
  },
});
