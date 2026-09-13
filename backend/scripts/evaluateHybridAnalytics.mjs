import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { generateDataset, protocol } from '../simulation/generateHybridEvaluation.mjs';
import { sum, percent, forecastMetrics, classificationMetrics, replayInventory,
  evaluatePlan, greedyFulfillment, prescriptionMetrics } from '../simulation/hybridEvaluationMetrics.mjs';
import { calculateUsageTrends, calculateShortageForecast, calculateTransferRecommendations }
  from '../../frontend/src/admin/analyticsEngine.js';

// Check scoring independently on hand-calculable examples BEFORE using it.
const m = forecastMetrics([{ forecast: 12, actual: 10 }, { forecast: 0, actual: 0 }, { forecast: 2, actual: 4 }]);
assert.equal(m.MAE, 4 / 3); assert.equal(m.MAPE_nonzero_percent, 35);
assert.equal(m.MAPE_excluded_zero_actual, 1); assert.equal(m.within20PercentCount, 2);
assert.equal(forecastMetrics([{ forecast: 0, actual: 0 }]).WAPE_percent, null);
const cm = classificationMetrics([{ alert: true, shortageWithoutReceipts: true },
  { alert: true, shortageWithoutReceipts: false }, { alert: false, shortageWithoutReceipts: true },
  { alert: false, shortageWithoutReceipts: false }]);
assert.equal(cm.accuracyPercent, 50); assert.equal(cm.F1Percent, 50);
const replayTest = replayInventory([{ available_units: 5, expiration_date: '2025-01-02', status: 'available' }],
  [{ date: '2025-01-01', units: 3 }, { date: '2025-01-02', units: 3 }]);
assert.equal(replayTest.unmetUnits, 3); assert.equal(replayTest.wastedUnits, 2);
const arrivalTest = replayInventory([], [{ date: '2025-01-01', units: 3 }],
  [{ actualDate: '2025-01-01', units: 3, expirationDate: '2025-01-02' }]);
assert.equal(arrivalTest.unmetUnits, 0);

const dataset = generateDataset();
const serializedDataset = JSON.stringify(dataset);
const datasetHash = createHash('sha256').update(serializedDataset).digest('hex');
assert.equal(createHash('sha256').update(JSON.stringify(generateDataset())).digest('hex'), datasetHash, 'Generation must be deterministic');
const predictions = [];
let trendMatches = 0;
for (const series of dataset.series) {
  assert.equal(series.daily.length, protocol.days);
  assert.ok(series.daily.every(row => Number.isInteger(row.units) && row.units >= 0));
  for (const snapshot of series.snapshots) {
    const now = new Date(snapshot.forecastAt);
    const past = series.daily.slice(0, snapshot.origin);
    const future = series.daily.slice(snapshot.origin, snapshot.origin + protocol.horizonDays);
    assert.ok(past.every(row => new Date(row.date) < now));
    assert.ok(future.every(row => new Date(row.date) >= now));
    assert.equal(future.length, 7);
    const requests = past.map(row => ({ id: row.day, request_date: row.date,
      blood_type: series.bloodType, component_type: 'whole_blood',
      status: 'delivered', units_approved: row.units }));
    const input = { requests, now };
    const trend = calculateUsageTrends(input)[0];
    const shortage = calculateShortageForecast({ ...input, inventory: snapshot.inventory }).rows[0];
    const current = sum(past.slice(-30).map(row => row.units));
    const previous = sum(past.slice(-60, -30).map(row => row.units));
    const change = previous > 0 ? 100 * (current - previous) / previous : current > 0 ? 100 : 0;
    const expectedTrend = change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable';
    if (trend?.trendKey === expectedTrend) trendMatches++;
    const withoutReceipts = replayInventory(snapshot.inventory, future);
    const withReceipts = replayInventory(snapshot.inventory, future, snapshot.receipts);
    predictions.push({ seriesId: series.id, seed: series.seed, pattern: series.pattern, anchor: series.id.split('-').slice(1, 3).join('-'),
      forecastAt: snapshot.forecastAt, forecast: trend?.expectedDemandNext7Days ?? 0,
      actual: sum(future.map(row => row.units)), baselineLastWeek: sum(past.slice(-7).map(row => row.units)),
      historicalTrend: trend?.trendKey ?? 'missing', expectedHistoricalTrend: expectedTrend,
      status: shortage?.supplyStatusKey ?? 'missing',
      alert: ['critical', 'critical_out', 'near_expiry_only', 'at_risk'].includes(shortage?.supplyStatusKey),
      shortageWithoutReceipts: withoutReceipts.shortage, shortageWithReceipts: withReceipts.shortage,
      withoutReceipts, withReceipts });
  }
}

const prescriptions = dataset.prescriptionScenarios.map(scenario => {
  const plan = calculateTransferRecommendations({ ...scenario, now: new Date(scenario.forecastAt) });
  const result = evaluatePlan(scenario, plan, protocol.reserveUnits);
  const greedyFulfilled = greedyFulfillment(scenario, protocol.reserveUnits);
  assert.ok(result.fulfilledWithSafetyCaps <= result.totalDemand);
  assert.ok(greedyFulfilled <= result.totalDemand);
  return { scenarioId: scenario.id, seed: scenario.seed, family: scenario.family, plan, ...result, greedyFulfilled };
});
// Independent evaluator sanity checks for single-source, covered, expired, split-source cases.
for (const family of ['routine', 'already_covered', 'stale_expired', 'fragmented_supply']) {
  const example = prescriptions.find(row => row.family === family);
  if (family === 'routine') assert.equal(example.feasible, true);
  if (family === 'already_covered') assert.equal(example.initiallyCovered, example.totalDemand);
  if (family === 'stale_expired') assert.equal(example.fulfilledWithSafetyCaps, 0);
  if (family === 'fragmented_supply') assert.equal(example.greedyFulfilled, example.totalDemand);
}
const sourceFiles = ['../../frontend/src/admin/analyticsEngine.js', '../simulation/paperPublishedData.mjs',
  '../simulation/generateHybridEvaluation.mjs', '../simulation/hybridEvaluationMetrics.mjs', './evaluateHybridAnalytics.mjs'];
const sourceHashes = {};
for (const source of sourceFiles) sourceHashes[source] = createHash('sha256').update(await readFile(new URL(source, import.meta.url))).digest('hex');
const report = {
  title: 'Synthetic simulation evaluation, NOT real-world hospital accuracy', protocol, datasetHash, sourceHashes,
  counts: { syntheticSeries: dataset.series.length, syntheticDailyRows: sum(dataset.series.map(s => s.daily.length)),
    sevenDayForecasts: predictions.length, prescriptionScenarios: prescriptions.length,
    pendingRequests: sum(dataset.prescriptionScenarios.map(s => s.requests.length)) },
  demand: forecastMetrics(predictions), baselineLastWeek: forecastMetrics(predictions, 'baselineLastWeek'),
  historicalTrendRuleAgreement: { matched: trendMatches, total: predictions.length,
    percent: percent(trendMatches, predictions.length), meaning: 'Descriptive calculation correctness, not future trend accuracy' },
  shortageNoReplenishment: classificationMetrics(predictions),
  shortageWithDelayedReceipts: classificationMetrics(predictions, 'shortageWithReceipts'),
  prescriptive: prescriptionMetrics(prescriptions),
  byPattern: Object.fromEntries(protocol.patterns.map(pattern => {
    const rows = predictions.filter(row => row.pattern === pattern);
    return [pattern, { demand: forecastMetrics(rows), baseline: forecastMetrics(rows, 'baselineLastWeek'),
      shortageNoReplenishment: classificationMetrics(rows), shortageWithReceipts: classificationMetrics(rows, 'shortageWithReceipts') }];
  })),
  bySeed: Object.fromEntries(protocol.seeds.map(seed => [seed, {
    demand: forecastMetrics(predictions.filter(row => row.seed === seed)),
    shortage: classificationMetrics(predictions.filter(row => row.seed === seed)),
    prescriptive: prescriptionMetrics(prescriptions.filter(row => row.seed === seed)),
  }])),
  byPrescriptionFamily: Object.fromEntries(protocol.prescriptionFamilies.map(family =>
    [family, prescriptionMetrics(prescriptions.filter(row => row.family === family))])),
};

const out = new URL('../simulation/output/hybrid-evaluation/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('synthetic-dataset.json', out), serializedDataset + '\n');
await writeFile(new URL('scores.json', out), JSON.stringify(report, null, 2) + '\n');
await writeFile(new URL('case-results.json', out), JSON.stringify({ predictions, prescriptions }, null, 2) + '\n');

const fmt = value => value === null ? 'N/A' : value.toFixed(2);
const d = report.demand, s = report.shortageNoReplenishment, p = report.prescriptive;
const markdown = `# BloodConnect: synthetic simulation scores

This is a seeded synthetic benchmark informed by published mean values, not original hospital records or real-world accuracy. The application engine was tested unchanged. No production database was accessed.

## Measured results

| Module / measure | Score |
| --- | ---: |
| Demand: forecasts within +/-20% of simulated next-week usage | ${fmt(d.within20PercentScore)}% (${d.within20PercentCount}/${d.n}) |
| Demand: MAE in units per seven-day forecast | ${fmt(d.MAE)} |
| Demand: RMSE in units per seven-day forecast | ${fmt(d.RMSE)} |
| Demand: WAPE (lower is better) | ${fmt(d.WAPE_percent)}% |
| Demand: MAPE on nonzero outcomes (lower is better) | ${fmt(d.MAPE_nonzero_percent)}% |
| Last-week baseline: MAE / WAPE | ${fmt(report.baselineLastWeek.MAE)} / ${fmt(report.baselineLastWeek.WAPE_percent)}% |
| Shortage detection: accuracy, no replenishment | ${fmt(s.accuracyPercent)}% |
| Shortage detection: precision / recall / F1 | ${fmt(s.precisionPercent)}% / ${fmt(s.recallPercent)}% / ${fmt(s.F1Percent)}% |
| Shortage detection: balanced accuracy | ${fmt(s.balancedAccuracyPercent)}% |
| Shortage detection: majority-class baseline accuracy | ${fmt(s.majorityClassBaselineAccuracyPercent)}% |
| Shortage detection: accuracy with delayed receipts | ${fmt(report.shortageWithDelayedReceipts.accuracyPercent)}% |
| Prescriptive: feasible raw transfer plans | ${fmt(p.feasiblePlanPercent)}% (${p.feasiblePlans}/${p.scenarios}) |
| Prescriptive: fulfilled units after externally applied safety caps | ${fmt(p.fulfillmentPercentWithSafetyCaps)}% |
| No-transfer baseline: fulfilled units | ${fmt(p.noTransferBaselineFulfillmentPercent)}% |
| Feasible split-source greedy comparator: fulfilled units | ${fmt(p.greedyReferenceFulfillmentPercent)}% |

Do not average these unlike measures into a single analytics accuracy. No 100-minus-MAPE score is used. The +/-20% tolerance is a declared benchmark choice, not a clinical acceptance standard. MAPE includes ${d.MAPE_included} outcomes and excludes ${d.MAPE_excluded_zero_actual} zero-usage outcomes; MAE, RMSE, WAPE and tolerance scoring include all cases. Zero actual demand counts within tolerance only when prediction is also zero.

## Data and chronology

- ${report.counts.syntheticSeries} synthetic series x ${protocol.days} days = ${report.counts.syntheticDailyRows} generated daily records; ${predictions.length} seven-day forecasts; ${prescriptions.length} prescriptive scenarios with ${report.counts.pendingRequests} pending requests.
- Nominal rate anchors: seven India phase mean weekly issue values divided by seven, and four Korean ABO mean daily usage values. Source details are in the dataset and the earlier Paper_Based_Analytics_Test_Report.md. Other fields and distributions are generated assumptions, not recovered missing hospital records.
- Seeds fixed before scoring: ${protocol.seeds.join(', ')}. No seeds or parameters were selected to improve scores.
- Each series has 60 days of initial history. Origins then advance seven days; the next seven days are withheld from each forecast. Later origins may use earlier evaluated days as newly available history. Test horizons within a series do not overlap; history windows do overlap, so cases are not statistically independent.
- Engine history consists of synthetic fulfilled requests at noon; forecast origin is midnight. Historical fulfilled usage equals generated demand by assumption (no historical supply censoring). The original engine uses the preceding 30 days; it is not retrained.
- Future data are generated independently of the engine by Poisson draws, weekday multipliers, demand shocks, level shifts, and intermittent zero demand. Exact parameters and random streams are in generateHybridEvaluation.mjs and the dataset protocol.
- Every input quantity is a nonnegative integer. Independent assertions check chronology, seven-day horizons, deterministic generation, scoring formulas, and inventory expiry/arrival behavior.
- Generated whole-blood records are numerical surrogates. Original red-cell labels remain unsupported. India uses a test-only ALL_UNSPECIFIED grouping; Korea uses unsigned ABO. Neither actual Rh proportions nor other component behavior is validated. Korean anchor usage originally includes waste, so these rates are only scale references, not validated patient-demand estimates.

## Forecast scores by pattern

| Pattern | Cases | Demand MAE | Demand WAPE | Within 20% | Shortage accuracy (no receipts) |
| --- | ---: | ---: | ---: | ---: | ---: |
${Object.entries(report.byPattern).map(([key, value]) => `| ${key} | ${value.demand.n} | ${fmt(value.demand.MAE)} | ${fmt(value.demand.WAPE_percent)}% | ${fmt(value.demand.within20PercentScore)}% | ${fmt(value.shortageNoReplenishment.accuracyPercent)}% |`).join('\n')}

## Shortage definition and limitations

An alert is a current engine status of critical, critical_out, near_expiry_only or at_risk. A true shortage means any unmet generated usage during the next seven days in an independent daily inventory replay. The replay expires batches at the start of each day and consumes earliest-expiring usable batches first. It does not use the engine's days-of-stock formula to label outcomes.

No-replenishment confusion matrix: TP=${s.TP}, TN=${s.TN}, FP=${s.FP}, FN=${s.FN}. Shortage prevalence is ${fmt(s.prevalencePercent)}%. The separate delayed-receipts evaluation uses the same forecast alerts against replayed receipt outcomes; the current engine has no receipt input, so this is an operational stress test, not a supported supply-aware forecast.

Inventory snapshots are independently generated for each origin, at 2/5/8/14 nominal days of stock with variation, split into a near-expiry batch and a later-expiry batch. They are not one continuous hospital inventory ledger. Replenishment occurs in a designed 60% probability of cases, with a 35% probability of a three-day delay when planned. These are assumptions, not measured hospital frequencies.

Historical trend-label rule agreement was ${report.historicalTrendRuleAgreement.matched}/${report.historicalTrendRuleAgreement.total}; this is descriptive formula correctness, NOT future trend accuracy.

## Prescriptive scoring

| Scenario family | Feasible plans | Feasibility score | Fulfillment after safety caps |
| --- | ---: | ---: | ---: |
${Object.entries(report.byPrescriptionFamily).map(([key, value]) => `| ${key} | ${value.feasiblePlans}/${value.scenarios} | ${fmt(value.feasiblePlanPercent)}% | ${fmt(value.fulfillmentPercentWithSafetyCaps)}% |`).join('\n')}

The feasibility score requires a complete priority-ordered plan with integer nonnegative units, no incompatible or self transfers, no transfers beyond the destination's unmet need, no expired supply, and cumulative source deductions that preserve the 20-unit hospital reserve (central stock has no reserve). These are explicit software constraints, not clinician-approved recommendations. Scenario families are deliberately equally weighted stress tests, not a representative hospital case mix.

Already-covered requests with positive suggestions, independently overcommitted source stock, and date-expired stock with stale available status remain failures; they are not repaired before scoring. Fulfillment is a separate hypothetical outcome after an external evaluator rejects or caps unsafe transfers. This external safety layer is NOT installed in the app and must not be presented as existing engine behavior.

The no-transfer baseline uses valid destination stock only. The greedy comparator independently applies priority order, cumulative available-stock deductions, expiry checks, and multiple sources when needed. It is a feasible heuristic, not an optimal or expert oracle. Immediate cost-free transfers and exact blood-group/component matching are assumed. Transport times, crossmatching, clinical suitability, donor selection, and future recipient expiry/wastage are not evaluated. The benchmark does not validate all possible prescriptive functions.

## Reproduce and audit

Run: \`node backend/scripts/evaluateHybridAnalytics.mjs\` from the repository root. A successful exit means the evaluator completed and its internal checks passed, not that the application met an acceptance threshold. This is an evaluation run with no declared clinical pass/fail threshold.

Artifacts under \`backend/simulation/output/hybrid-evaluation/\`:

- \`synthetic-dataset.json\`: all generated input records, dates, outcomes, source provenance and protocol.
- \`scores.json\`: aggregate, per-pattern, per-seed and per-family scores; source hashes.
- \`case-results.json\`: every prediction/outcome, raw recommendation and violation.

Dataset SHA-256 (compact JSON before final newline): \`${datasetHash}\`.

Forecast metric definitions and holdout rationale: [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html). Classification metric definitions: [scikit-learn model evaluation documentation](https://scikit-learn.org/stable/modules/model_evaluation.html). These sources support measurement definitions, not the validity of the synthetic clinical assumptions.

## Suggested capstone statement

BloodConnect was evaluated using seeded synthetic scenarios informed by published aggregate blood usage statistics. Seven-day usage forecasts had MAE ${fmt(d.MAE)} units and WAPE ${fmt(d.WAPE_percent)}%; ${fmt(d.within20PercentScore)}% were within 20% of simulated usage. Seven-day shortage detection achieved ${fmt(s.accuracyPercent)}% accuracy and ${fmt(s.F1Percent)}% F1 under no replenishment. ${fmt(p.feasiblePlanPercent)}% of constructed transfer plans satisfied all tested constraints. Results are conditional on the simulation design and do not establish real-world predictive accuracy or clinical effectiveness.
`;
await writeFile(new URL('../../docs/Hybrid_Analytics_Simulation_Scores.md', import.meta.url), markdown);
console.log(JSON.stringify({ counts: report.counts, demand: d, baseline: report.baselineLastWeek,
  shortage: s, shortageWithReceipts: report.shortageWithDelayedReceipts, prescriptive: p,
  datasetHash, report: 'docs/Hybrid_Analytics_Simulation_Scores.md' }, null, 2));
