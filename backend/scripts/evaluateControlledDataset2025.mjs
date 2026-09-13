import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateShortageForecast,
  calculateTransferRecommendations,
  calculateUsageTrends,
} from '../../frontend/src/admin/analyticsEngine.js'
import { classificationMetrics, forecastMetrics } from '../simulation/hybridEvaluationMetrics.mjs'

const DAY = 86_400_000
const datasetDir = process.argv[2] || 'C:/Users/JEPOY/Downloads/BloodConnect_1Year_Controlled_Dataset_2025'
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = path.join(rootDir, 'output', 'controlled-dataset-2025')
const reportPath = path.join(rootDir, 'docs', 'Controlled_Dataset_2025_Analytics_Report.md')

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, ''))
  return rows.filter((values) => values.some((value) => value !== '')).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const csvNames = [
  'blood_units.csv', 'blood_usage_history.csv', 'donations_supply.csv',
  'expected_test_scenarios.csv', 'hospital_requests.csv', 'inventory_history.csv',
]
const rawFiles = Object.fromEntries(await Promise.all(csvNames.map(async (name) =>
  [name, await readFile(path.join(datasetDir, name), 'utf8')])))
const data = Object.fromEntries(csvNames.map((name) => [name, parseCsv(rawFiles[name])]))
const units = data['blood_units.csv']
const usage = data['blood_usage_history.csv']
const supply = data['donations_supply.csv']
const scenarios = data['expected_test_scenarios.csv']
const requests = data['hospital_requests.csv']
const inventory = data['inventory_history.csv']

const n = (value) => Number(value || 0)
const key = (row) => `${row.hospital_id}|${row.blood_type}|${row.component}`
const dayKey = (row) => `${row.date}|${key(row)}`
const unitDayKey = (date, row) => `${date}|${key(row)}`
const utcDate = (text) => new Date(`${text}T00:00:00Z`)
const ymd = (date) => date.toISOString().slice(0, 10)
const addDays = (text, days) => ymd(new Date(utcDate(text).getTime() + days * DAY))
const sum = (rows, field) => rows.reduce((total, row) => total + n(row[field]), 0)
const percent = (value, total) => total ? value / total * 100 : null
const approx = (left, right, tolerance = 1e-9) => Math.abs(left - right) <= tolerance
const componentName = (value) => value.toLowerCase().replace(' ', '_')
const hospitalNumber = (id) => Number(id.replace(/^H/, ''))

// Independent integrity checks; the supplied validation_report.txt is not trusted as executable evidence.
const checks = []
const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail })
check('inventory row count', inventory.length === 52_560, `${inventory.length}/52,560`)
check('usage row count', usage.length === 52_560, `${usage.length}/52,560`)
check('supply row count', supply.length === 52_560, `${supply.length}/52,560`)
check('request IDs unique', new Set(requests.map((row) => row.request_id)).size === requests.length, `${requests.length} requests`)
check('blood-unit IDs unique', new Set(units.map((row) => row.blood_unit_id)).size === units.length, `${units.length} units`)
check('daily inventory keys unique', new Set(inventory.map(dayKey)).size === inventory.length, `${inventory.length} daily keys`)
check('daily usage keys unique', new Set(usage.map(dayKey)).size === usage.length, `${usage.length} daily keys`)
check('daily supply keys unique', new Set(supply.map(dayKey)).size === supply.length, `${supply.length} daily keys`)
check('inventory arithmetic', inventory.every((row) =>
  n(row.opening_inventory) + n(row.units_received) - n(row.units_fulfilled) - n(row.units_expired) === n(row.closing_inventory)), 'opening + received - fulfilled - expired = closing')
check('nonnegative inventory', inventory.every((row) => ['opening_inventory', 'units_received', 'units_fulfilled', 'units_expired', 'closing_inventory', 'near_expiry_units'].every((field) => n(row[field]) >= 0)), 'all inventory measures >= 0')
check('usage quantity constraints', usage.every((row) => n(row.units_transfused) <= n(row.units_fulfilled) && n(row.units_fulfilled) <= n(row.units_requested)), 'transfused <= fulfilled <= requested')
check('request quantity constraints', requests.every((row) => n(row.units_fulfilled) <= n(row.units_requested)), 'fulfilled <= requested')

const inventoryBySeries = new Map()
for (const row of inventory) {
  if (!inventoryBySeries.has(key(row))) inventoryBySeries.set(key(row), [])
  inventoryBySeries.get(key(row)).push(row)
}
let continuityFailures = 0
for (const rows of inventoryBySeries.values()) {
  rows.sort((a, b) => a.date.localeCompare(b.date))
  for (let index = 1; index < rows.length; index += 1) {
    if (n(rows[index].opening_inventory) !== n(rows[index - 1].closing_inventory)) continuityFailures += 1
  }
}
check('day-to-day inventory continuity', continuityFailures === 0, `${continuityFailures} mismatches`)

const aggregate = (rows, dateField, valueField) => {
  const result = new Map()
  for (const row of rows) {
    const mapKey = `${row[dateField]}|${key(row)}`
    result.set(mapKey, (result.get(mapKey) || 0) + n(row[valueField]))
  }
  return result
}
const requestedByDay = aggregate(requests, 'request_date', 'units_requested')
const requestFulfilledByDay = aggregate(requests, 'request_date', 'units_fulfilled')
check('request totals reconcile to usage', usage.every((row) =>
  (requestedByDay.get(dayKey(row)) || 0) === n(row.units_requested) &&
  (requestFulfilledByDay.get(dayKey(row)) || 0) === n(row.units_fulfilled)), 'daily requested and fulfilled totals')
check('supply reconciles to inventory receipts', supply.every((row) => {
  const inv = inventoryBySeries.get(key(row))?.find((item) => item.date === row.date)
  return inv && n(inv.units_received) === n(row.units_received)
}), 'daily units received')

const usedByDay = new Map()
const expiredByDay = new Map()
let chronologyFailures = 0
for (const row of units) {
  const received = utcDate(row.received_date)
  const expires = utcDate(row.expiration_date)
  if (expires < received) chronologyFailures += 1
  if (row.used_date !== 'N/A') {
    const used = utcDate(row.used_date)
    if (used < received || used >= expires) chronologyFailures += 1
    const mapKey = unitDayKey(row.used_date, row)
    usedByDay.set(mapKey, (usedByDay.get(mapKey) || 0) + 1)
  }
  if (row.expired_date !== 'N/A') {
    const mapKey = unitDayKey(row.expired_date, row)
    expiredByDay.set(mapKey, (expiredByDay.get(mapKey) || 0) + 1)
  }
}
check('blood-unit chronology', chronologyFailures === 0, `${chronologyFailures} invalid date sequences`)
check('unit usage reconciles to inventory', inventory.every((row) => (usedByDay.get(dayKey(row)) || 0) === n(row.units_fulfilled)), 'unit used dates vs fulfilled units')
check('unit expirations reconcile to inventory', inventory.every((row) => (expiredByDay.get(dayKey(row)) || 0) === n(row.units_expired)), 'unit expired dates vs expired units')

const failedChecks = checks.filter((item) => !item.passed)
assert.equal(failedChecks.length, 0, `Dataset integrity failures: ${failedChecks.map((item) => item.name).join(', ')}`)

const usageSeries = new Map()
for (const row of usage) {
  if (!usageSeries.has(key(row))) usageSeries.set(key(row), [])
  usageSeries.get(key(row)).push(row)
}
for (const rows of usageSeries.values()) rows.sort((a, b) => a.date.localeCompare(b.date))

const toEngineRequests = (rows) => rows.filter((row) => n(row.units_requested) > 0).map((row, index) => ({
  id: index + 1,
  hospital_id: hospitalNumber(row.hospital_id),
  blood_type: row.blood_type,
  component_type: componentName(row.component),
  status: n(row.units_fulfilled) < n(row.units_requested) ? 'partially_fulfilled' : 'fulfilled',
  units_requested: n(row.units_requested),
  units_approved: n(row.units_fulfilled),
  actual_fulfilled_units: n(row.units_fulfilled),
  fulfilled_at: `${row.date}T12:00:00Z`,
  request_date: `${row.date}T12:00:00Z`,
}))

const toEngineInventory = (row, atDate) => {
  const stock = n(row.closing_inventory)
  const expiring = Math.min(stock, n(row.near_expiry_units))
  const common = {
    hospital_id: hospitalNumber(row.hospital_id), blood_type: row.blood_type,
    component_type: componentName(row.component), status: 'available',
  }
  return [
    ...(expiring ? [{ ...common, id: 1, available_units: expiring, expiration_date: addDays(atDate, 3) }] : []),
    ...(stock - expiring ? [{ ...common, id: 2, available_units: stock - expiring, expiration_date: addDays(atDate, 30) }] : []),
    ...(!stock ? [{ ...common, id: 3, available_units: 0, expiration_date: addDays(atDate, 30) }] : []),
  ]
}

const forecastCases = []
for (const [seriesKey, rows] of usageSeries) {
  const inventoryRows = inventoryBySeries.get(seriesKey)
  for (let originIndex = 30; originIndex <= rows.length - 7; originIndex += 7) {
    const origin = rows[originIndex].date
    const history = rows.slice(Math.max(0, originIndex - 60), originIndex)
    const future = rows.slice(originIndex, originIndex + 7)
    const engineRequests = toEngineRequests(history)
    const now = new Date(`${origin}T00:00:00Z`)
    const trend = calculateUsageTrends({ requests: engineRequests, now })[0]
    const priorInventory = inventoryRows[originIndex - 1]
    const shortage = calculateShortageForecast({
      inventory: toEngineInventory(priorInventory, addDays(origin, -1)),
      requests: engineRequests,
      now,
    }).rows[0]
    const legacyUsableStock = Math.max(0, (shortage?.currentStock || 0) - (shortage?.expiringSoonUnits || 0))
    const legacyDaysRemaining = (shortage?.usage || 0) > 0
      ? legacyUsableStock / ((shortage?.usage || 0) / 30)
      : Infinity
    const actual = sum(future, 'units_fulfilled')
    const requested = sum(future, 'units_requested')
    const recent30 = history.slice(-30)
    const requested30 = sum(recent30, 'units_requested')
    const fulfilled30 = sum(recent30, 'units_fulfilled')
    forecastCases.push({
      seriesKey, forecastAt: origin,
      forecast: trend?.expectedDemandNext7Days || 0,
      baselineLastWeek: sum(history.slice(-7), 'units_fulfilled'),
      actual, requested,
      status: shortage?.supplyStatusKey || 'missing',
      currentStock: shortage?.currentStock || 0,
      expiringSoonUnits: shortage?.expiringSoonUnits || 0,
      usableStock: shortage?.usableStock || 0,
      usage30: shortage?.usage || 0,
      requested30,
      fulfilled30,
      recentUnmetUnits: Math.max(0, requested30 - fulfilled30),
      recentUnmetDays: recent30.filter((row) => n(row.units_requested) > n(row.units_fulfilled)).length,
      received30: sum(inventoryRows.slice(Math.max(0, originIndex - 30), originIndex), 'units_received'),
      numericDaysRemaining: Number.isFinite(shortage?.numericDaysRemaining) ? shortage.numericDaysRemaining : null,
      alert: shortage?.shortageAlert === true,
      legacyAlert: legacyUsableStock === 0 || legacyDaysRemaining < 7,
      shortageWithoutReceipts: requested > actual,
    })
  }
}

const demand = forecastMetrics(forecastCases)
const baseline = forecastMetrics(forecastCases, 'baselineLastWeek')
const shortage = classificationMetrics(forecastCases)
const legacyShortage = classificationMetrics(forecastCases.map((row) => ({ ...row, alert: row.legacyAlert })))

// Prescriptive stress test: treat each hidden seven-day requested total as a pending workload.
// This tests whether the plan is feasible, not whether the engine could know future requests.
const priorityScore = { Normal: 1, Urgent: 2, Critical: 3 }
const requestPriorityByDay = new Map()
for (const row of requests) {
  const mapKey = `${row.request_date}|${key(row)}`
  const current = requestPriorityByDay.get(mapKey) || 'Normal'
  if ((priorityScore[row.priority] || 1) > (priorityScore[current] || 1)) requestPriorityByDay.set(mapKey, row.priority)
}
const hospitals = [...new Map(inventory.map((row) => [row.hospital_id, {
  id: hospitalNumber(row.hospital_id), hospital_name: row.hospital_name,
}])).values()]
const originDates = [...new Set(forecastCases.map((row) => row.forecastAt))].sort()
const prescriptionRuns = []
for (const origin of originDates) {
  const priorDate = addDays(origin, -1)
  const snapshotRows = inventory.filter((row) => row.date === priorDate)
  const snapshot = snapshotRows.flatMap((row, index) =>
    toEngineInventory(row, priorDate).map((item) => ({ ...item, id: index * 3 + item.id })))
  const pending = []
  for (const [seriesKey, rows] of usageSeries) {
    const index = rows.findIndex((row) => row.date === origin)
    const future = rows.slice(index, index + 7)
    const unitsRequested = sum(future, 'units_requested')
    if (unitsRequested <= 0) continue
    const [hospitalId, bloodType, component] = seriesKey.split('|')
    let priority = 'Normal'
    for (const row of future) {
      const candidate = requestPriorityByDay.get(`${row.date}|${seriesKey}`) || 'Normal'
      if ((priorityScore[candidate] || 1) > (priorityScore[priority] || 1)) priority = candidate
    }
    pending.push({ id: `${origin}|${seriesKey}`, hospital_id: hospitalNumber(hospitalId), blood_type: bloodType,
      component_type: componentName(component), units_requested: unitsRequested, status: 'pending',
      priority: priority.toLowerCase(), request_date: origin })
  }
  const plan = calculateTransferRecommendations({ inventory: snapshot, requests: pending, hospitals,
    reserveAtSourceUnits: 20, now: utcDate(origin) })
  const initialByLocation = new Map()
  for (const item of snapshot) {
    const mapKey = `h:${item.hospital_id}|${item.blood_type}|${item.component_type}`
    initialByLocation.set(mapKey, (initialByLocation.get(mapKey) || 0) + n(item.available_units))
  }
  const sentByLocation = new Map()
  let feasible = plan.length === pending.length
  let totalDemand = 0
  let initiallyCovered = 0
  let fulfilled = 0
  for (const row of plan) {
    totalDemand += row.unitsRequested
    initiallyCovered += row.destinationUnitsApplied
    fulfilled += Math.min(row.unitsRequested, row.destinationUnitsApplied + row.suggestedUnits)
    if (!Number.isInteger(row.suggestedUnits) || row.suggestedUnits < 0 || row.suggestedUnits > row.unitsNeeded) feasible = false
    if (row.sourceLocationKey && row.sourceLocationKey === `h:${row.destinationHospitalId}`) feasible = false
    if (row.sourceLocationKey) {
      const sourceKey = `${row.sourceLocationKey}|${row.bloodType}|${row.componentType}`
      sentByLocation.set(sourceKey, (sentByLocation.get(sourceKey) || 0) + row.suggestedUnits)
    }
  }
  for (const [sourceKey, sent] of sentByLocation) {
    if (sent > Math.max(0, (initialByLocation.get(sourceKey) || 0) - 20)) feasible = false
  }
  prescriptionRuns.push({ origin, feasible, requests: pending.length, totalDemand, initiallyCovered, fulfilled })
}
const prescriptionTotals = prescriptionRuns.reduce((result, row) => ({
  runs: result.runs + 1,
  feasibleRuns: result.feasibleRuns + (row.feasible ? 1 : 0),
  requests: result.requests + row.requests,
  totalDemand: result.totalDemand + row.totalDemand,
  initiallyCovered: result.initiallyCovered + row.initiallyCovered,
  fulfilled: result.fulfilled + row.fulfilled,
}), { runs: 0, feasibleRuns: 0, requests: 0, totalDemand: 0, initiallyCovered: 0, fulfilled: 0 })
const prescriptive = {
  ...prescriptionTotals,
  feasiblePlanPercent: percent(prescriptionTotals.feasibleRuns, prescriptionTotals.runs),
  noTransferCoveragePercent: percent(prescriptionTotals.initiallyCovered, prescriptionTotals.totalDemand),
  recommendationCoveragePercent: percent(prescriptionTotals.fulfilled, prescriptionTotals.totalDemand),
}

const scenarioResults = scenarios.map((scenario) => {
  const seriesKey = `${scenario.hospital_id}|${scenario.blood_type}|${scenario.component}`
  const rows = usageSeries.get(seriesKey)
  const invRows = inventoryBySeries.get(seriesKey)
  const startIndex = rows.findIndex((row) => row.date === scenario.start_date)
  const endIndex = rows.findIndex((row) => row.date === scenario.end_date)
  const startHistory = rows.slice(Math.max(0, startIndex - 60), startIndex)
  const startTrend = calculateUsageTrends({
    requests: toEngineRequests(startHistory), now: utcDate(scenario.start_date),
  })[0]
  const expectedForecastMatch = scenario.expected_predictive_result.match(/projects ([0-9.]+) units/i)
  const expectedForecast = expectedForecastMatch ? Number(expectedForecastMatch[1]) : null
  const engineForecast = startTrend?.expectedDemandNext7Days || 0
  const forecastMatchesExpected = expectedForecast === null ? null : Math.abs(engineForecast - expectedForecast) <= 0.011
  const dailySignals = []
  for (let index = startIndex; index <= endIndex; index += 1) {
    const history = rows.slice(Math.max(0, index - 60), index)
    const now = new Date(`${rows[index].date}T00:00:00Z`)
    const engineRequests = toEngineRequests(history)
    const trend = calculateUsageTrends({ requests: engineRequests, now })[0]
    const priorInventory = invRows[Math.max(0, index - 1)]
    const stock = calculateShortageForecast({
      inventory: toEngineInventory(priorInventory, priorInventory.date), requests: engineRequests, now,
    }).rows[0]
    dailySignals.push({ date: rows[index].date, trend: trend?.trendKey, unusual: trend?.unusualKey, status: stock?.supplyStatusKey,
      stock: stock?.currentStock || 0, expiring: stock?.expiringSoonUnits || 0, usage30: stock?.usage || 0 })
  }
  const condition = scenario.expected_condition.toLowerCase()
  let supported = true
  let detected = false
  if (condition.includes('increasing')) detected = dailySignals.some((row) => row.trend === 'increasing')
  else if (condition.includes('spike')) detected = dailySignals.some((row) => row.unusual === 'spike')
  else if (condition === 'shortage') detected = dailySignals.some((row) => ['critical', 'critical_out', 'near_expiry_only', 'low'].includes(row.status))
  else if (condition.includes('out of stock')) detected = dailySignals.some((row) => row.status === 'critical_out')
  else if (condition.includes('overstock')) detected = dailySignals.some((row) => row.status === 'sufficient' && row.stock > 4 * Math.max(1, row.usage30 / 30 * 7))
  else if (condition.includes('near expiry') || condition.includes('wastage')) detected = dailySignals.some((row) => row.expiring > 0)
  else if (condition.includes('no recent usage')) detected = dailySignals.some((row) => row.status === 'sufficient_no_usage')
  else if (condition.includes('unknown')) detected = dailySignals.some((row) => row.status === 'at_risk')
  else if (condition.includes('normal supply')) detected = dailySignals.some((row) => row.status === 'sufficient' && row.trend === 'stable')
  else if (condition.includes('transfer opportunity')) {
    const targetId = scenario.hospital_id === 'H001' ? 'H006' : scenario.hospital_id === 'H004' ? 'H005' : scenario.hospital_id
    const snapshotDate = addDays(scenario.start_date, -1)
    const snapshot = inventory.filter((row) => row.date === snapshotDate).flatMap((row, index) =>
      toEngineInventory(row, snapshotDate).map((item) => ({ ...item, id: index * 3 + item.id })))
    const targetSeries = usageSeries.get(`${targetId}|${scenario.blood_type}|${scenario.component}`)
    const targetIndex = targetSeries.findIndex((row) => row.date === scenario.start_date)
    const need = Math.max(1, sum(targetSeries.slice(targetIndex, targetIndex + 7), 'units_requested'))
    const plan = calculateTransferRecommendations({
      inventory: snapshot,
      hospitals: [...new Map(inventory.map((row) => [row.hospital_id, { id: hospitalNumber(row.hospital_id), hospital_name: row.hospital_name }])).values()],
      requests: [{ id: scenario.scenario_id, hospital_id: hospitalNumber(targetId), blood_type: scenario.blood_type,
        component_type: componentName(scenario.component), units_requested: need, status: 'pending', priority: 'urgent', request_date: scenario.start_date }],
      reserveAtSourceUnits: 20,
      now: utcDate(scenario.start_date),
    })[0]
    detected = plan?.sourceLocationKey === `h:${hospitalNumber(scenario.hospital_id)}` && plan.suggestedUnits > 0
  } else if (condition.includes('reduced supply')) {
    supported = false
    detected = false
  }
  return { scenarioId: scenario.scenario_id, name: scenario.scenario_name, condition: scenario.expected_condition,
    supported, detected, expectedForecast, engineForecast, forecastMatchesExpected,
    expectedAction: scenario.expected_prescriptive_action, signals: dailySignals }
})

const supportedScenarios = scenarioResults.filter((row) => row.supported)
const scenarioMatches = supportedScenarios.filter((row) => row.detected).length
const forecastLabeledScenarios = scenarioResults.filter((row) => row.expectedForecast !== null)
const scenarioForecastMatches = forecastLabeledScenarios.filter((row) => row.forecastMatchesExpected).length

const hashes = Object.fromEntries(csvNames.map((name) => [name, createHash('sha256').update(rawFiles[name]).digest('hex')]))
const result = {
  dataset: { directory: datasetDir, hashes, counts: Object.fromEntries(csvNames.map((name) => [name, data[name].length])) },
  integrity: { passed: checks.length - failedChecks.length, total: checks.length, checks },
  protocol: {
    forecastHorizonDays: 7, historyDays: 30, originStepDays: 7,
    forecastCases: forecastCases.length,
    note: 'Per-hospital/product chronological rolling-origin evaluation; no future rows are supplied to the engine.',
  },
  demand, baseline, prescriptive,
  shortage: { ...shortage, groundTruth: 'At least one requested unit was unfulfilled during the next seven days.' },
  legacyShortage,
  expectedScenarioDetection: { matched: scenarioMatches, supported: supportedScenarios.length,
    percent: percent(scenarioMatches, supportedScenarios.length), excludedUnsupported: scenarios.length - supportedScenarios.length },
  expectedScenarioForecasts: { matched: scenarioForecastMatches, total: forecastLabeledScenarios.length,
    percent: percent(scenarioForecastMatches, forecastLabeledScenarios.length), toleranceUnits: 0.011 },
  scenarioResults,
}

await mkdir(outputDir, { recursive: true })
await mkdir(path.dirname(reportPath), { recursive: true })
await writeFile(path.join(outputDir, 'scores.json'), JSON.stringify(result, null, 2) + '\n')
await writeFile(path.join(outputDir, 'forecast-cases.json'), JSON.stringify(forecastCases, null, 2) + '\n')

const f = (value) => value === null ? 'N/A' : Number(value).toFixed(2)
const report = `# BloodConnect controlled-dataset analytics test

## Executive summary

This report evaluates the current BloodConnect analytics engine on the supplied **Controlled Synthetic Historical Blood Inventory and Utilization Dataset** for 2025. It is a software-validation result, not evidence of real-world clinical accuracy.

| Measure | Result |
| --- | ---: |
| Independent data-integrity checks | ${result.integrity.passed}/${result.integrity.total} passed |
| Seven-day demand forecasts | ${demand.n.toLocaleString()} |
| Demand MAE | ${f(demand.MAE)} units |
| Demand RMSE | ${f(demand.RMSE)} units |
| Demand WAPE | ${f(demand.WAPE_percent)}% |
| Demand MAPE (nonzero actuals) | ${f(demand.MAPE_nonzero_percent)}% |
| Forecasts within ±20% | ${f(demand.within20PercentScore)}% (${demand.within20PercentCount}/${demand.n}) |
| Shortage classification accuracy | ${f(shortage.accuracyPercent)}% |
| Shortage precision / recall / F1 | ${f(shortage.precisionPercent)}% / ${f(shortage.recallPercent)}% / ${f(shortage.F1Percent)}% |
| Shortage balanced accuracy | ${f(shortage.balancedAccuracyPercent)}% |
| Prescriptive feasible plans | ${f(prescriptive.feasiblePlanPercent)}% (${prescriptive.feasibleRuns}/${prescriptive.runs}) |
| Pending demand covered after recommendations | ${f(prescriptive.recommendationCoveragePercent)}% |
| Pending demand covered without transfers | ${f(prescriptive.noTransferCoveragePercent)}% |
| Expected scenario forecast reproduction | ${f(result.expectedScenarioForecasts.percent)}% (${scenarioForecastMatches}/${forecastLabeledScenarios.length}) |
| Expected-scenario condition detection | ${f(result.expectedScenarioDetection.percent)}% (${scenarioMatches}/${supportedScenarios.length}) |

There is no defensible single combined “predictive and prescriptive accuracy” because demand error, shortage classification, condition detection, and plan feasibility measure different outcomes. Lower MAE/RMSE/WAPE/MAPE is better; higher classification and scenario-detection scores are better.

Compared with the previous shortage rule, classification accuracy changed from ${f(legacyShortage.accuracyPercent)}% to ${f(shortage.accuracyPercent)}%, while false alerts fell from ${legacyShortage.FP} to ${shortage.FP}. The stricter critical-alert policy intentionally moves uncertain cases to a yellow monitoring state, so recall must be reviewed alongside the false-alert reduction.

## Test protocol

- Dataset period: 2025-01-01 through 2025-12-31; six hospitals, eight blood groups, and three components.
- Each demand forecast uses only the preceding 30 days of fulfilled usage. Shortage risk additionally uses requested demand and recent under-fulfillment. The following seven days are withheld and used as ground truth.
- Origins advance by seven days, yielding ${demand.n.toLocaleString()} forecasts without overlapping future horizons within a series.
- The engine is tested per hospital because the supplied scenario labels are hospital-specific. Hospital IDs H001–H006 are mapped to numeric IDs 1–6 without changing their identities.
- Shortage truth is positive when requested units exceed fulfilled units at least once over the hidden seven-day horizon. Only critical, out-of-stock, and unusable-near-expiry states count as confirmed alerts; low and uncertain states remain visible monitoring warnings.
- The last-seven-day naive forecast is included as a comparator: MAE ${f(baseline.MAE)} units and WAPE ${f(baseline.WAPE_percent)}%.
- For the prescriptive stress test, each hidden seven-day requested total is converted into a pending request only after forecast scoring. This tests plan constraint feasibility and potential coverage over ${prescriptive.runs} weekly snapshots; it is not a claim that future requests were available to the prediction model.

## Confusion matrix for seven-day shortage detection

| | Actual shortage | No actual shortage |
| --- | ---: | ---: |
| Engine alert | ${shortage.TP} (TP) | ${shortage.FP} (FP) |
| No engine alert | ${shortage.FN} (FN) | ${shortage.TN} (TN) |

The shortage prevalence was ${f(shortage.prevalencePercent)}%; the majority-class baseline accuracy was ${f(shortage.majorityClassBaselineAccuracyPercent)}%. Accuracy should therefore be interpreted together with recall, F1, and balanced accuracy.

## Controlled scenario results

| ID | Expected condition | Detected | Expected 7-day forecast | Engine forecast | Forecast match |
| --- | --- | :---: | ---: | ---: | :---: |
${scenarioResults.map((row) => `| ${row.scenarioId} | ${row.condition} | ${row.supported ? (row.detected ? 'Yes' : 'No') : 'N/A'} | ${f(row.expectedForecast)} | ${f(row.engineForecast)} | ${row.forecastMatchesExpected ? 'Yes' : 'No'} |`).join('\n')}

Forecast reproduction uses the numeric expected values embedded in the supplied scenario file and a ±0.011-unit rounding tolerance. S001 is expected to differ because only five prior days exist: the dataset's expected value annualizes those five available days, while the application intentionally divides by a fixed 30-day window.

The condition score measures agreement with labeled **conditions**, including transfer-source matching for the two source scenarios. It does not claim that free-text operational recommendations have been clinically validated. The “Reduced Supply” condition is excluded because the current predictive engine accepts inventory and fulfilled usage but does not accept donation/supply-rate history.

## Data-integrity verification

${checks.map((item) => `- ${item.passed ? 'PASS' : 'FAIL'} — ${item.name}: ${item.detail}`).join('\n')}

## Important limitations

- The dataset is controlled and synthetic, generated with a disclosed fixed seed. Scores can validate software behavior against known patterns but cannot establish real-hospital performance.
- Fulfilled usage is censored during shortages, so a demand model trained only on fulfilled quantities can underestimate unmet clinical demand.
- Aggregate near-expiry counts were represented as separate inventory batches for testing because the frontend engine expects batch-level expiration dates.
- The shortage module does not model future donations or transfers. The December reduced-supply condition is therefore unsupported by the current feature inputs.
- Prescriptive recommendations still use a heuristic and do not model transport time, crossmatching, clinical suitability, or future replenishment.

## Reproduction

From the repository root:

\`node backend/scripts/evaluateControlledDataset2025.mjs "${datasetDir.replaceAll('\\', '/')}"\`

Machine-readable scores and case-level forecast results are stored under \`output/controlled-dataset-2025/\`.
`
await writeFile(reportPath, report)

console.log(JSON.stringify({
  integrity: result.integrity,
  forecasts: demand.n,
  demand,
  baseline,
  shortage: result.shortage,
  legacyShortage,
  prescriptive,
  scenarios: result.expectedScenarioDetection,
  scenarioForecasts: result.expectedScenarioForecasts,
  report: reportPath,
}, null, 2))
