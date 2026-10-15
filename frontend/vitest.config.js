import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { include: ['tests/unit/**/*.test.js'], reporters: ['default'], testTimeout: 10_000 },
})
