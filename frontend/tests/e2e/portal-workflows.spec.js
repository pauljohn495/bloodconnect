import { expect, test } from '@playwright/test'

async function mockApi(page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/feature-flags') return route.fulfill({ json: { data: { flags: {}, routeChecks: [], registry: [] } } })
    if (path === '/api/auth/login') { const { role } = route.request().postDataJSON(); return route.fulfill({ json: { token: `test-${role}-token`, user: { role } } }) }
    if (path === '/api/hospital/inventory') return route.fulfill({ json: { status: 'success', data: [{ id: 7, blood_type: 'O+', component_type: 'whole_blood', available_units: 8, expiration_date: '2026-10-01', status: 'available' }] } })
    if (path === '/api/hospital/donations') return route.fulfill({ json: { status: 'success', data: [] } })
    if (path === '/api/admin/dashboard/summary') return route.fulfill({ json: { status: 'success', data: {} } })
    if (path === '/api/admin/inventory' || path === '/api/admin/transfers' || path === '/api/admin/requests' || path.startsWith('/api/user/')) return route.fulfill({ json: { status: 'success', data: [] } })
    return route.fulfill({ json: { status: 'success', data: [] } })
  })
}
async function login(page, role) {
  await page.goto('/'); await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Login' }).click()
  if (role !== 'donor') await page.getByRole('button', { name: role }).click()
  await page.locator('#bc-identifier').fill(`${role}.test`); await page.locator('#bc-password').fill('Password123!')
  await page.getByRole('button', { name: `Sign in as ${role}` }).click()
}
async function goAuthenticated(page, role, path) {
  await page.addInitScript(({ role }) => { localStorage.setItem('role', role); localStorage.setItem('token', `test-${role}-token`) }, { role })
  await page.goto(path)
}

test('BC-E2E-001 donor login submits isolated data and routes to donor dashboard', async ({ page }) => {
  await mockApi(page); await login(page, 'donor'); await expect(page).toHaveURL(/\/dashboard$/)
  await page.screenshot({ path: 'test-results/evidence/BC-E2E-001-donor-dashboard.png', fullPage: true })
})
test('BC-E2E-002 hospital login renders isolated mocked inventory data', async ({ page }) => {
  await mockApi(page); await login(page, 'hospital'); await expect(page).toHaveURL(/\/hospital\/inventory$/)
  await expect(page.getByText('Blood inventory', { exact: true })).toBeVisible(); await expect(page.locator('tbody').getByText('O+', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/evidence/BC-E2E-002-hospital-inventory.png', fullPage: true })
})
test('BC-E2E-003 admin login reaches the admin dashboard without a production API', async ({ page }) => {
  await mockApi(page); await login(page, 'admin'); await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await expect(page.getByText('Blood stock trend', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/evidence/BC-E2E-003-admin-dashboard.png', fullPage: true })
})

test('BC-E2E-004 hospital validates and reviews a multi-field blood request', async ({ page }) => {
  await mockApi(page); await goAuthenticated(page, 'hospital', '/hospital/blood-request')
  await page.locator('select').nth(2).selectOption('O+')
  await page.locator('input[type="number"]').first().fill('3')
  await page.getByRole('button', { name: /Review 1 request/ }).click()
  await expect(page.getByRole('heading', { name: 'Review blood requests' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit requests' })).toBeVisible()
  await page.screenshot({ path: 'test-results/evidence/BC-E2E-004-hospital-request.png', fullPage: true })
})

test('BC-E2E-005 hospital opens an inventory donation with unit boundary input', async ({ page }) => {
  await mockApi(page); await goAuthenticated(page, 'hospital', '/hospital/inventory')
  await page.getByRole('button', { name: 'Record Donation' }).click()
  await page.locator('input[type="number"]').fill('2')
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
  await page.screenshot({ path: 'test-results/evidence/BC-E2E-005-hospital-donation.png', fullPage: true })
})

test('BC-E2E-006 administrator validates the add-stock form fields', async ({ page }) => {
  await mockApi(page); await goAuthenticated(page, 'admin', '/admin/inventory')
  await page.getByRole('button', { name: 'Add Stock' }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Stock' })).toBeVisible()
  await page.locator('select').last().selectOption('A+')
  await page.locator('input[type="number"]').fill('9')
  await page.locator('input[type="date"]').fill('2026-12-31')
  await expect(page.getByRole('button', { name: 'Add Stock' }).last()).toBeEnabled()
  await page.screenshot({ path: 'test-results/evidence/BC-E2E-006-admin-add-stock.png', fullPage: true })
})
