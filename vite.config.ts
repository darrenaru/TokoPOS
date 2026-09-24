import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Tauri expects a fixed port and to fail if it's already in use.
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Jangan memantau build artifacts Rust, sering menyebabkan EBUSY di Windows.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Environment variables prefixed with TAURI_ are exposed to the frontend.
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_DEBUG ? false : undefined,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
