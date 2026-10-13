import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'cn': path.resolve(import.meta.dirname, './src/lib/utils.ts'),
    },
  },
  server: {
    port: 5173,
  },
})
