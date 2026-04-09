/**
 * Vite Library Build
 *
 * Single IIFE bundle with everything included (React, Zustand, etc.)
 * for drop-in <script> tag usage. Also produces an ESM build.
 *
 * The IIFE exposes window.CursorBuddy with an init() method.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      // Disable Fast Refresh and force production JSX transform.
      // Without this, the plugin emits jsxDEV() calls which don't
      // exist in the production React runtime bundled into the IIFE.
      fastRefresh: false,
      development: false,
      jsxRuntime: "automatic",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  mode: "production",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "CursorBuddy",
      formats: ["iife", "es"],
      fileName: (format) => `cursor-buddy.${format}.js`,
    },
    rollupOptions: {},
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    target: "es2020",
    minify: "esbuild",
  },
});
