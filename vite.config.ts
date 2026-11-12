import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Multi-entry build for a Manifest V3 extension:
//  - popup.html, dashboard.html, blocked.html are the three UI pages
//  - src/background/index.ts becomes dist/background.js (the service worker)
// Anything inside /public (manifest.json, icons) is copied to dist/ as-is.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "popup.html"),
        dashboard: resolve(import.meta.dirname, "dashboard.html"),
        blocked: resolve(import.meta.dirname, "blocked.html"),
        background: resolve(import.meta.dirname, "src/background/index.ts"),
      },
      output: {
        // The manifest points at "background.js", so it must keep a fixed name.
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
