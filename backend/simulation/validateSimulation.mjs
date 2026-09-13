import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  calculateShortageForecast,
  calculateTransferRecommendations,
  calculateUsageTrends,
} from '../../frontend/src/admin/analyticsEngine.js'
import simulationDefinition from './controlledData.mjs'
import uiSimulationData from '../../frontend/src/admin/analyticsSimulationData.js'

const data = {
  ...uiSimulationData,
  holdoutActuals: simulationDefinition.holdoutActuals,
}

const directory = path.dirname(fileURLToPath(import.meta.url))
const expected = JSON.parse(await readFile(path.join(directory, 'expectedResults.json'), 'utf8'))
const failures = []
let checks = 0

function check(label, actual, wanted, tolerance = 0) {
  checks += 1
  try {
    if (typeof wanted === 'number' && tolerance > 0) {
      assert.ok(Math.abs(actual - wanted) <= tolerance, `expected ${wanted}, received ${actual}`)
    } else {
      assert.deepEqual(actual, wanted)
    }
  } catch (error) {
    failures.push({ label, expected: wanted, actual, message: error.message })
  }
}

const now = new Date(data.referenceDate)
const shortage = calculateShortageForecast({ inventory: data.inventory, requests: data.requests, now })
const trends = calculateUsageTrends({ requests: data.requests, now, periodDays: 30 })
const prescriptions = calculateTransferRecommendations({
  inventory: data.inventory,
  requests: data.requests,
  hospitals: data.hospitals,
  now,
})

const earliestHistoricalDate = data.requests
  .filter((request) => request.status === 'delivered')
  .map((request) => request.request_date)
  .sort()[0]
check('dataset starts in March 2026', earliestHistoricalDate.slice(0, 7), '2026-03')
check('reference date is fixed', data.referenceDate, expected.referenceDate)

for (const [key, wanted] of Object.entries(expected.predictive)) {
  const forecast = shortage.rows.find((row) => `${row.bloodType}|${row.componentType}` === key)
  check(`${key} forecast row exists`, Boolean(forecast), true)
  if (!forecast) continue
  for (const property of ['currentStock', 'expiringSoonUnits', 'usableStock', 'estimatedDaysRemaining', 'supplyStatusKey']) {
    check(`${key} ${property}`, forecast[property], wanted[property])
  }
  if (wanted.usage30Days !== undefined) check(`${key} usage30Days`, forecast.usage, wanted.usage30Days)

  if (wanted.trendKey !== undefined) {
    const trend = trends.find((row) => row.key === key)
    check(`${key} trend row exists`, Boolean(trend), true)
    if (!trend) continue
    check(`${key} previousUnits`, trend.previousUnits, wanted.previousUnits)
    check(`${key} currentUnits`, trend.currentUnits, wanted.currentUnits)
    check(`${key} percentChange`, trend.percentChange, wanted.percentChange, 0.000001)
    check(`${key} predictedDemand7Days`, trend.expectedDemandNext7Days, wanted.predictedDemand7Days, 0.000001)
    check(`${key} trendKey`, trend.trendKey, wanted.trendKey)
    check(`${key} demandRiskKey`, trend.demandRiskKey, wanted.demandRiskKey)
    check(`${key} unusualKey`, trend.unusualKey, wanted.unusualKey)
  }
}

check('prescription count', prescriptions.length, expected.prescriptive.length)
check('prescription priority/order', prescriptions.map((row) => row.requestId), expected.prescriptive.map((row) => row.requestId))
for (const wanted of expected.prescriptive) {
  const actual = prescriptions.find((row) => row.requestId === wanted.requestId)
  check(`request ${wanted.requestId} recommendation exists`, Boolean(actual), true)
  if (!actual) continue
  for (const property of ['priority', 'unitsNeeded', 'sourceLocationKey', 'suggestedUnits', 'recommendation']) {
    check(`request ${wanted.requestId} ${property}`, actual[property], wanted[property])
  }
}

const holdoutComparisons = data.holdoutActuals.map((actual) => {
  const key = `${actual.bloodType}|${actual.componentType}`
  const trend = trends.find((row) => row.key === key)
  const predicted = trend?.expectedDemandNext7Days ?? 0
  const error = predicted - actual.actualUnitsNext7Days
  return { ...actual, predictedUnitsNext7Days: predicted, error, absoluteError: Math.abs(error) }
})
const meanAbsoluteError = holdoutComparisons.reduce((sum, row) => sum + row.absoluteError, 0) / holdoutComparisons.length
const meanAbsolutePercentageError = holdoutComparisons.reduce((sum, row) => sum + row.absoluteError / row.actualUnitsNext7Days, 0) / holdoutComparisons.length * 100
const bias = holdoutComparisons.reduce((sum, row) => sum + row.error, 0) / holdoutComparisons.length
check('holdout MAE', meanAbsoluteError, 0.125, 0.000001)
check('holdout bias', bias, 0.125, 0.000001)

const report = {
  generatedAt: new Date().toISOString(),
  simulationReferenceDate: data.referenceDate,
  dataset: {
    historicalPeriod: { start: '2026-03-01', end: '2026-08-31' },
    inventoryRecords: data.inventory.length,
    requestRecords: data.requests.length,
    donorRecords: data.donors.length,
    hospitalRecords: data.hospitals.length,
  },
  result: failures.length === 0 ? 'PASS' : 'FAIL',
  checks,
  passed: checks - failures.length,
  failed: failures.length,
  forecastAccuracy: { meanAbsoluteError, meanAbsolutePercentageError, bias, holdoutComparisons },
  failures,
}

await mkdir(path.join(directory, 'output'), { recursive: true })
await writeFile(path.join(directory, 'output', 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(`Analytics simulation: ${report.result}`)
console.log(`Checks: ${report.passed}/${report.checks} passed`)
console.log(`7-day holdout MAE: ${meanAbsoluteError.toFixed(3)} units`)
console.log(`7-day holdout MAPE: ${meanAbsolutePercentageError.toFixed(2)}%`)
console.log(`Report: ${path.join(directory, 'output', 'validation-report.json')}`)
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL: ${failure.label} (${failure.message})`))
  process.exitCode = 1
}
