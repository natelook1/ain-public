import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  // Use the plugin to handle the heavy lifting of inlining CSS/JS
  plugins: [react(), viteSingleFile()],
  build: {
    minify: true, // Recommended for single-file to keep the HTML size down
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // Effectively inlines all assets regardless of size
    rollupOptions: {
      output: {
        // vite-plugin-singlefile will ignore these names and 
        // put everything into index.html
        inlineDynamicImports: true,
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true
  }
})
