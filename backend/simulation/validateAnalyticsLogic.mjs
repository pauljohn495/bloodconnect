import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  calculateShortageForecast,
  calculateTransferRecommendations,
  calculateUsageTrends,
  normalizeComponentType,
} from '../../frontend/src/admin/analyticsEngine.js'

const require = createRequire(import.meta.url)
const { allocateNearExpiryInventory, toFiniteNonNegative } = require('../services/adminAnalyticsLogic')
const now = new Date('2026-09-09T12:00:00Z')
const inventory = (extra = {}) => ({
  id: 1,
  blood_type: 'O+',
  component_type: 'whole_blood',
  available_units: 76,
  expiration_date: '2026-10-09',
  status: 'available',
  hospital_id: 1,
  ...extra,
})
const request = (extra = {}) => ({
  id: 1,
  blood_type: 'O+',
  component_type: 'whole_blood',
  status: 'delivered',
  request_date: '2026-09-08T12:00:00Z',
  units_approved: 30,
  ...extra,
})
const pending = (id, hospitalId, units = 39, priority = 'normal') => request({
  id,
  hospital_id: hospitalId,
  hospital_name: `Hospital ${hospitalId}`,
  status: 'pending',
  units_requested: units,
  units_approved: null,
  priority,
})

let checks = 0
const check = (name, callback) => {
  callback()
  checks += 1
  console.log(`PASS: ${name}`)
}

check('unknown components are rejected instead of relabeled', () => {
  assert.equal(normalizeComponentType('red_blood_cells'), '')
})
check('usage without inventory creates an out-of-stock shortage row', () => {
  const rows = calculateShortageForecast({ inventory: [], requests: [request()], now }).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].supplyStatusKey, 'critical_out')
})
check('delivery date takes precedence over old request date', () => {
  const rows = calculateUsageTrends({ requests: [request({ request_date: '2026-07-01', delivered_at: '2026-09-08' })], now })
  assert.equal(rows[0].currentUnits, 30)
})
check('fulfilled completed usage is included', () => {
  const rows = calculateUsageTrends({ requests: [request({ status: 'fulfilled', fulfilled_at: '2026-09-08' })], now })
  assert.equal(rows[0].currentUnits, 30)
})
check('negative usage is rejected', () => {
  const row = calculateShortageForecast({ inventory: [inventory()], requests: [request({ units_approved: -30 })], now }).rows[0]
  assert.equal(row.usage, 0)
  assert.equal(row.supplyStatusKey, 'sufficient_no_usage')
})
check('source allocations are cumulative and preserve reserve', () => {
  const rows = calculateTransferRecommendations({
    inventory: [inventory()], requests: [pending(1, 2, 39, 'critical'), pending(2, 3, 39)], now,
  })
  assert.deepEqual(rows.map((row) => row.suggestedUnits), [39, 17])
})
check('destination stock is consumed across its requests', () => {
  const rows = calculateTransferRecommendations({
    inventory: [inventory({ hospital_id: 2, available_units: 52 })],
    requests: [pending(1, 2, 39, 'critical'), pending(2, 2, 39)], now,
  })
  assert.deepEqual(rows.map((row) => [row.destinationUnitsApplied, row.unitsNeeded]), [[39, 0], [13, 26]])
})
check('already-covered request has zero transfer suggestion', () => {
  const row = calculateTransferRecommendations({
    inventory: [inventory(), inventory({ id: 2, hospital_id: 2, available_units: 52 })],
    requests: [pending(1, 2)], now,
  })[0]
  assert.equal(row.suggestedUnits, 0)
  assert.equal(row.sourceLocationKey, null)
})
check('past-expiry stock is unavailable even with stale status', () => {
  const row = calculateTransferRecommendations({
    inventory: [inventory({ expiration_date: '2000-01-01' })], requests: [pending(1, 2)], now,
  })[0]
  assert.equal(row.suggestedUnits, 0)
})
check('near-expiry stock remains usable before its expiry deadline', () => {
  const row = calculateShortageForecast({
    inventory: [inventory({ available_units: 10, expiration_date: '2026-09-12' })],
    requests: [request()], now,
  }).rows[0]
  assert.equal(row.usableExpiringStock, 3)
  assert.equal(row.supplyStatusKey, 'low')
  assert.equal(row.shortageAlert, false)
})
check('zero stock and zero recent usage is uncertain, not a shortage alert', () => {
  const row = calculateShortageForecast({
    inventory: [inventory({ available_units: 0 })], requests: [], now,
  }).rows[0]
  assert.equal(row.supplyStatusKey, 'at_risk')
  assert.equal(row.shortageAlert, false)
})
check('persistent severe under-fulfillment raises a critical alert', () => {
  const partial = (id, date) => request({ id, status: 'partially_fulfilled', request_date: date,
    units_requested: 10, units_approved: 10, actual_fulfilled_units: 1 })
  const row = calculateShortageForecast({
    inventory: [inventory({ available_units: 10 })],
    requests: [partial(1, '2026-09-07'), partial(2, '2026-09-08')], now,
  }).rows[0]
  assert.equal(row.persistentUnderfill, true)
  assert.equal(row.supplyStatusKey, 'critical')
  assert.equal(row.shortageAlert, true)
})
check('backend allocator continues partial requests across batches', () => {
  const result = allocateNearExpiryInventory(
    [inventory({ id: 1, available_units: '5', days_until_expiry: 2 }), inventory({ id: 2, available_units: '10', days_until_expiry: 3 })],
    [pending(1, 2, 12)],
  )
  assert.equal(result.transferRecommendations.reduce((sum, row) => sum + row.units, 0), 12)
  assert.deepEqual(result.inventory.map((row) => row.available_units), [0, 3])
})
check('backend allocator gives scarce stock to critical request first', () => {
  const result = allocateNearExpiryInventory(
    [inventory({ available_units: 5, days_until_expiry: 2 })],
    [pending(1, 2, 5, 'normal'), pending(2, 3, 5, 'critical')],
  )
  assert.deepEqual(result.transferRecommendations.map((row) => row.requestId), [2])
})
check('backend numeric strings are normalized before arithmetic', () => {
  assert.equal(toFiniteNonNegative('10'), 10)
  assert.equal(toFiniteNonNegative('invalid'), 0)
})

console.log(`Analytics logic regression checks: ${checks}/${checks} passed`)
