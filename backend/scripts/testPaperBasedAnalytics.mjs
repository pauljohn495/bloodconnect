import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import {
  calculateUsageTrends, calculateShortageForecast,
  calculateTransferRecommendations, normalizeComponentType,
} from '../../frontend/src/admin/analyticsEngine.js';
import { india, korea, provenance } from '../simulation/paperPublishedData.mjs';

// Offline engine tests only: no database, network, application-state changes or ML training.
// Fractional, constant-rate daily records below are mathematical fixtures, not donations.
const now = new Date('2026-01-01T12:00:00Z');
const DAY = 86400000;
const checks = [];
const trendResults = [];
const shortageResults = [];
const prescriptionResults = [];
const close = (a, b) => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const test = (category, name, run) => {
  try { run(); checks.push({ category, name, passed: true }); }
  catch (error) { checks.push({ category, name, passed: false, message: error.message }); }
};

function history(dailyRate, priorDailyRate = dailyRate, bloodType = 'ALL_UNSPECIFIED') {
  return Array.from({ length: 60 }, (_, i) => ({
    id: i + 1, status: 'delivered', blood_type: bloodType,
    // Deliberate supported-component surrogate for numerical testing ONLY.
    // Original product identity remains in provenance; no RBC -> WB data import occurs.
    component_type: 'whole_blood',
    units_approved: i < 30 ? dailyRate : priorDailyRate,
    request_date: new Date(now.getTime() - (i + 0.5) * DAY).toISOString(),
  }));
}

function numericCase(name, dailyRate, previousRate, stock, bloodType, expectedTrend, expectedStatus) {
  const requests = history(dailyRate, previousRate, bloodType);
  const trend = calculateUsageTrends({ requests, now })[0];
  const shortage = calculateShortageForecast({
    requests, now,
    inventory: [{ blood_type: bloodType, component_type: 'whole_blood', status: 'available', available_units: stock }],
  }).rows[0];
  test('usage_arithmetic', name, () => {
    assert.equal(calculateUsageTrends({ requests, now }).length, 1);
    close(trend.currentUnits, dailyRate * 30);
    close(trend.previousUnits, previousRate * 30);
    close(trend.expectedDemandNext7Days, dailyRate * 7);
    assert.equal(trend.trendKey, expectedTrend);
  });
  test('shortage_arithmetic', name, () => {
    close(shortage.numericDaysRemaining, stock / dailyRate);
    close(shortage.usableStock, stock);
    assert.equal(shortage.supplyStatusKey, expectedStatus);
  });
  trendResults.push({ name, constructedCurrentDailyRate: dailyRate, constructedPreviousDailyRate: previousRate,
    forecast7Days: trend.expectedDemandNext7Days, trend: trend.trendKey });
  shortageResults.push({ name, constructedSnapshotStock: stock, daysRemaining: shortage.numericDaysRemaining,
    status: shortage.supplyStatusKey, assumesNoExpiryOrReplenishment: true });
}

const indiaTrends = ['stable', 'decreasing', 'increasing', 'decreasing', 'decreasing', 'increasing', 'increasing'];
const indiaStatuses = ['low', 'sufficient', 'low', 'sufficient', 'sufficient', 'low', 'low'];
india.forEach((row, i) => numericCase(`India phase ${row.phase}`, row.weeklyIssued / 7,
  india[Math.max(0, i - 1)].weeklyIssued / 7, row.averageStock, 'ALL_UNSPECIFIED', indiaTrends[i], indiaStatuses[i]));

// A five-day starting-stock scenario, NOT an estimate of actual Korean inventory.
// In particular, mean(DU) * mean(ISI) is NOT assumed to equal mean(stock).
korea.forEach(row => numericCase(`Korea ABO ${row.abo}`, row.averageDailyUsage, row.averageDailyUsage,
  5 * row.averageDailyUsage, row.abo, 'stable', 'critical'));

const hospitals = [{ id: 1, hospital_name: 'Constructed source' },
  { id: 2, hospital_name: 'Constructed destination A' }, { id: 3, hospital_name: 'Constructed destination B' }];
const inventoryRow = (units, hospitalId, extra = {}) => ({
  available_units: units, hospital_id: hospitalId, blood_type: 'ALL_UNSPECIFIED',
  component_type: 'whole_blood', status: 'available', ...extra,
});
const pending = (id, hospitalId, units, priority = 'normal') => ({
  id, hospital_id: hospitalId, hospital_name: hospitals.find(h => h.id === hospitalId).hospital_name,
  blood_type: 'ALL_UNSPECIFIED', component_type: 'whole_blood', status: 'pending',
  units_requested: units, priority, created_at: now.toISOString(),
});
function transferCase(name, inventory, requests, verify) {
  const result = calculateTransferRecommendations({ inventory, requests, hospitals, now });
  prescriptionResults.push({ name, constructedInventory: inventory, constructedRequests: requests, result });
  test('prescriptive_scenario', name, () => verify(result));
}

// India A's stock 76 and weekly usage 39 supply the scale, not actual transfer events.
const sourceStock = india[0].averageStock;
const requestUnits = india[0].weeklyIssued;
transferCase('Hospital transfer respects the 20-unit reserve for one request',
  [inventoryRow(sourceStock, 1)], [pending(1, 2, requestUnits)], rows => {
    assert.equal(rows.length, 1); assert.equal(rows[0].sourceLocationKey, 'h:1');
    assert.equal(rows[0].suggestedUnits, requestUnits);
    assert.ok(sourceStock - rows[0].suggestedUnits >= 20);
  });
// Korea's O daily mean supplies the scale; ceil(6.1*7)=43 is an invented request.
const koreanRequest = Math.ceil(korea[0].averageDailyUsage * 7);
transferCase('Central dispatch for constructed Korean-scale request',
  [inventoryRow(sourceStock, null)], [pending(2, 2, koreanRequest)], rows => {
    assert.equal(rows[0].sourceLocationKey, 'central');
    assert.equal(rows[0].suggestedUnits, koreanRequest);
  });
transferCase('No source triggers external-supply recommendation', [], [pending(3, 2, requestUnits)], rows => {
  assert.equal(rows[0].suggestedUnits, 0);
  assert.equal(rows[0].recommendation, 'Contact donors / coordinate external supply');
});
transferCase('Already-covered request should suggest zero transfer units',
  [inventoryRow(sourceStock, 1), inventoryRow(india[1].averageStock, 2)], [pending(4, 2, requestUnits)], rows => {
    assert.equal(rows[0].unitsNeeded, 0);
    assert.equal(rows[0].suggestedUnits, 0, 'Already covered, but suggestedUnits is nonzero');
  });
transferCase('Concurrent recommendations must not collectively overcommit source stock',
  [inventoryRow(sourceStock, 1)], [pending(5, 2, requestUnits, 'critical'), pending(6, 3, requestUnits)], rows => {
    assert.equal(rows[0].requestId, 5);
    const total = rows.reduce((sum, row) => sum + row.suggestedUnits, 0);
    assert.ok(total <= sourceStock - 20, `Suggested ${total}; sendable stock is only ${sourceStock - 20}`);
  });
transferCase('Past-expiration stock with stale available status must not be suggested',
  [inventoryRow(sourceStock, 1, { expiration_date: '2000-01-01' })], [pending(7, 2, requestUnits)], rows => {
    assert.equal(rows[0].suggestedUnits, 0, 'Expired by date, but included in suggested stock');
  });

for (const component of ['packed_red_blood_cells', 'red_blood_cells']) {
  test('product_compatibility', `Preserve or explicitly reject ${component}`, () => {
    assert.notEqual(normalizeComponentType(component), 'whole_blood', 'Unsupported red-cell component silently becomes whole_blood');
  });
}

const engineUrl = new URL('../../frontend/src/admin/analyticsEngine.js', import.meta.url);
const report = {
  title: 'Published-aggregate-based controlled validation; NOT real-world predictive accuracy',
  engineSha256: createHash('sha256').update(await readFile(engineUrl)).digest('hex'),
  referenceTime: now.toISOString(), provenance, publishedAggregates: { india, korea },
  assumptions: [
    'Daily rates are spread uniformly across two artificial 30-day windows using fractional units.',
    'India phase means are mapped to equal windows solely for arithmetic checks; actual phase durations differ.',
    'India phase A has an artificial identical prior window; other phases use the preceding phase mean.',
    'Korean prior and current rates are artificially identical; no actual temporal trend can be inferred.',
    'India average stock is used as a hypothetical snapshot; Korean stock is a constructed five-day supply.',
    'Whole-blood is a deliberate numerical surrogate only; original red-cell records cannot be imported unchanged.',
    'No Rh signs are invented. ALL_UNSPECIFIED is a test-only label, not a real blood group.',
    'Transfers, hospital identities, priorities and expiration scenarios are constructed, not reported events.',
    'No underlying hospital/day ground truth, expert recommendations or operational outcomes are available.',
  ],
  metrics: { realWorldForecastMAE: null, realWorldForecastMAPE: null, shortageAccuracy: null,
    prescriptiveEffectiveness: null, reason: 'Original dated observations and independent outcomes are not present in the PDFs.' },
  summary: Object.fromEntries([...new Set(checks.map(c => c.category))].map(category => {
    const cases = checks.filter(c => c.category === category);
    return [category, { passed: cases.filter(c => c.passed).length, total: cases.length }];
  })), checks, trendResults, shortageResults, prescriptionResults,
};
const outputDir = new URL('../simulation/output/paper-based/', import.meta.url);
await mkdir(outputDir, { recursive: true });
await writeFile(new URL('results.json', outputDir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ summary: report.summary, failures: checks.filter(c => !c.passed),
  trendResults, shortageResults, report: 'backend/simulation/output/paper-based/results.json' }, null, 2));
// Deliberately fail the test command when safety/compatibility checks fail.
if (checks.some(c => !c.passed)) process.exitCode = 1;
