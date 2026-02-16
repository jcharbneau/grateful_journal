import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "src",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      "@": path.resolve("src")
    }
  }
});
