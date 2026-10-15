import { describe, expect, it } from 'vitest'
import { calculateDonorAvailability, calculateShortageForecast, calculateTransferRecommendations, calculateUsageTrends } from '../../src/admin/analyticsEngine.js'

// Fixed inputs and independently calculated expected values make these repeatable research checks.
const NOW = new Date('2026-09-01T12:00:00Z')
const inventory = (overrides = {}) => ({ id: 1, blood_type: 'O+', component_type: 'whole_blood', available_units: 20, status: 'available', expiration_date: '2026-10-01', hospital_id: null, ...overrides })
const fulfilled = (overrides = {}) => ({ id: 1, blood_type: 'O+', component_type: 'whole_blood', units_requested: 30, units_approved: 30, status: 'fulfilled', fulfilled_at: '2026-08-20', ...overrides })

describe('BC-UNIT analytics rules', () => {
  it('BC-UNIT-001 calculates inventory coverage from requested 30-day demand', () => {
    const row = calculateShortageForecast({ inventory: [inventory()], requests: [fulfilled()], now: NOW }).rows[0]
    // Demand=30/30 days; seven-day demand=7; stock=20; coverage=20/7.
    expect(row).toMatchObject({ currentStock: 20, historicalDemand: 30, expectedDemandNext7Days: 7, supplyStatusKey: 'sufficient' })
  })
  it('BC-UNIT-002 excludes expired inventory and flags demand with no usable stock', () => {
    const row = calculateShortageForecast({ inventory: [inventory({ expiration_date: '2026-08-31' })], requests: [fulfilled()], now: NOW }).rows[0]
    expect(row).toMatchObject({ currentStock: 0, usableStock: 0, supplyStatusKey: 'critical_out', shortageAlert: true })
  })
  it('BC-UNIT-003 limits soon-expiring stock to consumption possible before expiry', () => {
    const row = calculateShortageForecast({ inventory: [inventory({ available_units: 10, expiration_date: '2026-09-04' })], requests: [fulfilled()], now: NOW }).rows[0]
    expect(row).toMatchObject({ expiringSoonUnits: 10, usableExpiringStock: 3, usableStock: 3, supplyStatusKey: 'low' })
  })
  it('BC-UNIT-004 identifies increasing usage and independently calculated seven-day demand', () => {
    const rows = calculateUsageTrends({ now: NOW, periodDays: 30, requests: [fulfilled({ id: 1, fulfilled_at: '2026-08-20', units_requested: 60, units_approved: 60 }), fulfilled({ id: 2, fulfilled_at: '2026-07-20', units_requested: 30, units_approved: 30 })] })
    expect(rows[0]).toMatchObject({ currentUnits: 60, previousUnits: 30, percentChange: 100, expectedDemandNext7Days: 14, trendKey: 'increasing', demandRiskKey: 'high', unusualKey: 'spike' })
  })
  it('BC-UNIT-005 applies whole blood (90), platelet (14), and plasma (28) recovery periods', () => {
    const result = calculateDonorAvailability({ now: NOW, horizonDays: 30, donors: [{ last_donation_date: '2026-06-01', last_donation_type: 'whole_blood' }, { last_donation_date: '2026-08-25', last_donation_type: 'platelets' }, { last_donation_date: '2026-08-10', last_donation_type: 'plasma' }, { last_donation_date: null }] })
    expect(result).toMatchObject({ total: 4, eligibleNow: 2, becomingInHorizon: 2, canDonateWithinHorizon: 4, percentWithinHorizon: 100, label: 'High Availability' })
  })
  it('BC-UNIT-006 gives scarce compatible stock to critical requests first', () => {
    const rows = calculateTransferRecommendations({ now: NOW, inventory: [inventory({ available_units: 10 })], requests: [{ id: 1, hospital_id: 2, blood_type: 'O+', component_type: 'whole_blood', units_requested: 10, priority: 'normal', status: 'pending', request_date: '2026-08-20' }, { id: 2, hospital_id: 3, blood_type: 'O+', component_type: 'whole_blood', units_requested: 10, priority: 'critical', status: 'pending', request_date: '2026-08-21' }], hospitals: [] })
    expect(rows.map(({ requestId, suggestedUnits }) => [requestId, suggestedUnits])).toEqual([[2, 10], [1, 0]])
  })
  it('BC-UNIT-007 is deterministic and does not mutate equivalent inputs', () => {
    const input = { inventory: [inventory()], requests: [fulfilled()], now: NOW }; const original = structuredClone(input)
    expect(calculateShortageForecast(input)).toEqual(calculateShortageForecast(structuredClone(input))); expect(input).toEqual(original)
  })
  it('BC-UNIT-008 returns safe empty output for invalid inputs', () => {
    expect(calculateShortageForecast({ inventory: null, requests: null, now: new Date('invalid') }).rows).toEqual([]); expect(calculateUsageTrends({ requests: null, now: NOW, periodDays: 0 })).toEqual([]); expect(calculateDonorAvailability({ donors: null, now: NOW, horizonDays: 0 }).label).toBe('Low Availability')
  })
})
