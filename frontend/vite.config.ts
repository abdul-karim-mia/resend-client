import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tiptap')) return 'tiptap'
          if (id.includes('@tanstack')) return 'tanstack'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/webhook': 'http://localhost:8787',
    },
  },
})
