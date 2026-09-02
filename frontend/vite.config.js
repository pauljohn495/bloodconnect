import { defineConfig, loadEnv } from 'vite'
import { cwd } from 'node:process'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '')
  const apiUrl = env.VITE_API_URL || env.VITE_API_BASE_URL || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': apiUrl,
      },
    },
  }
})
