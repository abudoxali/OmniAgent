import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([{
      entry: 'electron/main.ts',
    }]),
    electronRenderer(),
  ],
  server: {
    port: 3100,
    open: false,
  },
})
