import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  calculateDonorAvailability,
  calculateShortageForecast,
  calculateTransferRecommendations,
  calculateUsageTrends,
} from '../../frontend/src/admin/analyticsEngine.js'
import simulationData from '../../frontend/src/admin/analyticsSimulationData.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const expected = JSON.parse(await readFile(path.join(directory, 'expectedResults.json'), 'utf8'))
const failures = []
const checksByCategory = {}

function check(category, label, actual, wanted, tolerance = 0) {
  checksByCategory[category] = (checksByCategory[category] || 0) + 1
  try {
    if (typeof wanted === 'number' && tolerance > 0) {
      assert.ok(Math.abs(actual - wanted) <= tolerance, `expected ${wanted}, received ${actual}`)
    } else {
      assert.deepEqual(actual, wanted)
    }
  } catch (error) {
    failures.push({ category, label, expected: wanted, actual, message: error.message })
  }
}

function processAnalytics(data) {
  const now = new Date(data.referenceDate)
  return {
    shortage: calculateShortageForecast({ inventory: data.inventory, requests: data.requests, now }),
    trends: calculateUsageTrends({ requests: data.requests, now, periodDays: 30 }),
    donorAvailability: calculateDonorAvailability({ donors: data.donors, now, horizonDays: 30 }),
    recommendations: calculateTransferRecommendations({
      inventory: data.inventory,
      requests: data.requests,
      hospitals: data.hospitals,
      now,
    }),
  }
}

const sourceSnapshot = structuredClone(simulationData)
const firstRun = processAnalytics(simulationData)
const { shortage, trends, donorAvailability, recommendations } = firstRun

const earliestHistoricalDate = simulationData.requests
  .filter((request) => request.status === 'delivered')
  .map((request) => request.request_date)
  .sort()[0]
check('fixture_integrity', 'dataset starts in March 2026', earliestHistoricalDate.slice(0, 7), '2026-03')
check('fixture_integrity', 'reference date is fixed', simulationData.referenceDate, expected.referenceDate)

for (const [key, wanted] of Object.entries(expected.outputs)) {
  const output = shortage.rows.find((row) => `${row.bloodType}|${row.componentType}` === key)
  check('output_correctness', `${key} shortage row exists`, Boolean(output), true)
  if (!output) continue
  for (const property of ['currentStock', 'expiringSoonUnits', 'usableStock', 'estimatedDaysRemaining', 'supplyStatusKey']) {
    check('output_correctness', `${key} ${property}`, output[property], wanted[property])
  }
  if (wanted.usage30Days !== undefined) {
    check('output_correctness', `${key} usage30Days`, output.usage, wanted.usage30Days)
  }

  if (wanted.trendKey !== undefined) {
    const trend = trends.find((row) => row.key === key)
    check('output_correctness', `${key} trend row exists`, Boolean(trend), true)
    if (!trend) continue
    check('output_correctness', `${key} previousUnits`, trend.previousUnits, wanted.previousUnits)
    check('output_correctness', `${key} currentUnits`, trend.currentUnits, wanted.currentUnits)
    check('output_correctness', `${key} percentChange`, trend.percentChange, wanted.percentChange, 0.000001)
    check('output_correctness', `${key} expectedDemandNext7Days`, trend.expectedDemandNext7Days, wanted.expectedDemandNext7Days, 0.000001)
    check('output_correctness', `${key} trendKey`, trend.trendKey, wanted.trendKey)
    check('output_correctness', `${key} demandRiskKey`, trend.demandRiskKey, wanted.demandRiskKey)
    check('output_correctness', `${key} unusualKey`, trend.unusualKey, wanted.unusualKey)
  }
}

for (const [property, wanted] of Object.entries(expected.donorAvailability)) {
  check('output_correctness', `donor availability ${property}`, donorAvailability[property], wanted)
}

check('output_correctness', 'recommendation count', recommendations.length, expected.prescriptive.length)
check(
  'output_correctness',
  'recommendation priority/order',
  recommendations.map((row) => row.requestId),
  expected.prescriptive.map((row) => row.requestId),
)
for (const wanted of expected.prescriptive) {
  const actual = recommendations.find((row) => row.requestId === wanted.requestId)
  check('output_correctness', `request ${wanted.requestId} recommendation exists`, Boolean(actual), true)
  if (!actual) continue
  for (const property of ['priority', 'unitsNeeded', 'sourceLocationKey', 'suggestedUnits', 'recommendation']) {
    check('output_correctness', `request ${wanted.requestId} ${property}`, actual[property], wanted[property])
  }
}

// The same data must always produce the same complete output, not merely similar totals.
const repeatedRuns = 5
for (let run = 2; run <= repeatedRuns; run += 1) {
  check('output_consistency', `repeat run ${run} matches run 1`, processAnalytics(simulationData), firstRun)
}
check(
  'output_consistency',
  'equivalent cloned input produces identical output',
  processAnalytics(structuredClone(simulationData)),
  firstRun,
)
check('input_integrity', 'processing does not mutate input data', simulationData, sourceSnapshot)

const totalChecks = Object.values(checksByCategory).reduce((sum, count) => sum + count, 0)
const failedByCategory = failures.reduce((counts, failure) => {
  counts[failure.category] = (counts[failure.category] || 0) + 1
  return counts
}, {})
const summary = Object.fromEntries(Object.entries(checksByCategory).map(([category, total]) => [category, {
  passed: total - (failedByCategory[category] || 0),
  failed: failedByCategory[category] || 0,
  total,
}]))
const canonicalOutput = JSON.stringify(firstRun, (_key, value) => {
  if (typeof value === 'number' && !Number.isFinite(value)) return `__${value}__`
  if (value === undefined) return '__undefined__'
  return value
})
const report = {
  title: 'BloodConnect analytics data-processing and output-consistency validation',
  purpose: 'Checks that controlled inputs are processed into known expected outputs and that identical inputs produce identical results.',
  generatedAt: new Date().toISOString(),
  referenceDate: simulationData.referenceDate,
  result: failures.length === 0 ? 'PASS' : 'FAIL',
  summary,
  checks: totalChecks,
  passed: totalChecks - failures.length,
  failed: failures.length,
  analyticsCovered: {
    predictive: ['blood shortage forecast', 'blood usage trends', 'donor availability insights'],
    prescriptive: ['donor outreach/campaign recommendation', 'inventory transfer recommendations'],
  },
  verifiedOutputs: {
    donorAvailability,
  },
  consistency: {
    repeatedRuns,
    exactOutputComparison: true,
    clonedInputComparison: true,
    inputMutationCheck: true,
    outputSha256: createHash('sha256').update(canonicalOutput).digest('hex'),
  },
  dataset: {
    historicalPeriod: { start: '2026-03-01', end: '2026-08-31' },
    inventoryRecords: simulationData.inventory.length,
    requestRecords: simulationData.requests.length,
    donorRecords: simulationData.donors.length,
    hospitalRecords: simulationData.hospitals.length,
  },
  limitations: [
    'This is functional and consistency testing against controlled fixtures, not a statistical accuracy study.',
    'A passing result shows conformance to the recorded expected outputs; it does not establish clinical effectiveness.',
    'The suite exercises the analytics engine directly and does not cover browser rendering, API transport, or a production database.',
  ],
  failures,
}

await mkdir(path.join(directory, 'output'), { recursive: true })
await writeFile(path.join(directory, 'output', 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(`Analytics processing and consistency: ${report.result}`)
console.log(`Checks: ${report.passed}/${report.checks} passed`)
for (const [category, result] of Object.entries(summary)) {
  console.log(`${category}: ${result.passed}/${result.total} passed`)
}
console.log(`Repeated identical runs: ${repeatedRuns}`)
console.log(`Output fingerprint: ${report.consistency.outputSha256}`)
console.log(`Report: ${path.join(directory, 'output', 'validation-report.json')}`)
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL: ${failure.label} (${failure.message})`))
  process.exitCode = 1
}
