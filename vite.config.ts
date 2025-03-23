import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/web"),
  server: {
    port: 3001,
    open: true,
    hmr: {
      port: 24679,
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/web"),
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "src/web/index.html"),
      },
    },
  },
});
