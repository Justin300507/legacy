import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js + drei + postprocessing are one ~1.6 MB bundle by nature; nothing to lazy-load in a single-scene app.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
  },
})
