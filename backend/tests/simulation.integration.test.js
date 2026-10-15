// Real API integration checks. This file deliberately refuses operational databases.
if (!String(process.env.DB_NAME || '').toLowerCase().endsWith('_simulation')) {
  throw new Error('Refusing simulation integration tests: set DB_NAME to an isolated name ending in _simulation')
}

const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const { app } = require('../server')
const { pool } = require('../db')

let server
let baseUrl
const tokens = {}

async function request(path, options = {}, token) {
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${baseUrl}${path}`, { ...options, headers })
}

async function login(role, identifier) {
  const response = await request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: 'Simulation123!', role }),
  })
  assert.equal(response.status, 200, `${role} login must succeed in the isolated simulation database`)
  const body = await response.json()
  assert.equal(body.data.user.role, role)
  return body.data.token
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve() })
  })
  tokens.admin = await login('admin', 'simulation_admin')
  tokens.hospital = await login('hospital', 'simulation_hospital_1')
  tokens.donor = await login('donor', 'sim_donor_901001')
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await pool.end()
})

test('BC-INT-001 admin analytics endpoints return controlled predictive and prescriptive outputs', async () => {
  const [prediction, prescription, historical] = await Promise.all([
    request('/api/admin/analytics/wastage-predictions', {}, tokens.admin),
    request('/api/admin/analytics/wastage-prescriptions', {}, tokens.admin),
    request('/api/admin/analytics/historical-wastage?days=90', {}, tokens.admin),
  ])
  assert.equal(prediction.status, 200); assert.equal(prescription.status, 200); assert.equal(historical.status, 200)
  const predictionBody = await prediction.json(); const prescriptionBody = await prescription.json(); const historicalBody = await historical.json()
  assert.ok(Array.isArray(predictionBody.inventoryWithRisk)); assert.ok(predictionBody.predictedWastage.next7Days >= 0)
  assert.ok(Array.isArray(prescriptionBody.transferRecommendations)); assert.ok(Array.isArray(historicalBody.wastageByBloodType))
})

test('BC-INT-002 hospital inventory, reports, and requests are isolated to the authenticated hospital', async () => {
  const [inventory, requests, predictions, history] = await Promise.all([
    request('/api/hospital/inventory', {}, tokens.hospital), request('/api/hospital/requests', {}, tokens.hospital),
    request('/api/hospital/analytics/wastage-predictions', {}, tokens.hospital), request('/api/hospital/analytics/historical-wastage?days=90', {}, tokens.hospital),
  ])
  for (const response of [inventory, requests, predictions, history]) assert.equal(response.status, 200)
  const inventoryBody = await inventory.json(); const requestsBody = await requests.json(); const predictionBody = await predictions.json(); const historyBody = await history.json()
  assert.ok(Array.isArray(inventoryBody.data)); assert.ok(inventoryBody.data.every((row) => Number(row.hospital_id) === 900101))
  assert.ok(Array.isArray(requestsBody.data)); assert.ok(predictionBody.data.predictedWastage); assert.ok(historyBody.data.period >= 1)
})

test('BC-INT-003 donor profile, donation, availability, eligibility, and schedule reads use only simulation records', async () => {
  const [profile, donations, availability, eligibility, schedules] = await Promise.all([
    request('/api/user/me', {}, tokens.donor), request('/api/user/donations', {}, tokens.donor),
    request('/api/user/blood-availability', {}, tokens.donor), request('/api/user/donation-eligibility', {}, tokens.donor),
    request('/api/user/schedule-requests', {}, tokens.donor),
  ])
  for (const response of [profile, donations, availability, eligibility, schedules]) assert.equal(response.status, 200)
  const profileBody = await profile.json(); const donationBody = await donations.json(); const availabilityBody = await availability.json(); const eligibilityBody = await eligibility.json(); const scheduleBody = await schedules.json()
  assert.match(profileBody.data.email, /@bloodconnect\.test$/); assert.ok(Array.isArray(donationBody.data))
  assert.ok(Number.isFinite(availabilityBody.data.totalAvailable)); assert.ok(eligibilityBody.data.whole_blood); assert.ok(Array.isArray(scheduleBody.data))
})

test('BC-INT-004 admin lists, hospital request validation, and role authorization enforce workflow boundaries', async () => {
  const [inventory, requests, donors, forbidden, invalid] = await Promise.all([
    request('/api/admin/inventory?scope=all', {}, tokens.admin), request('/api/admin/requests', {}, tokens.admin), request('/api/admin/donors', {}, tokens.admin),
    request('/api/admin/inventory', {}, tokens.donor),
    request('/api/hospital/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bloodType: 'INVALID', unitsRequested: 1 }) }, tokens.hospital),
  ])
  assert.equal(inventory.status, 200); assert.equal(requests.status, 200); assert.equal(donors.status, 200)
  assert.equal(forbidden.status, 403); assert.equal(invalid.status, 400)
})
