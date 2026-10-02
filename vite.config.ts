import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // The tree lives in IndexedDB for this exact origin; a different port would show an empty tree.
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: {
    // three.js + drei + postprocessing are one ~1.6 MB bundle by nature; nothing to lazy-load in a single-scene app.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
  },
})
