import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e', outputDir: 'test-results/e2e-artifacts',
  reporter: [['html', { outputFolder: 'test-results/e2e-html', open: 'never' }], ['list']],
  use: { baseURL: 'http://127.0.0.1:4173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm.cmd run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
