// Independent outcome simulation and scoring; does not import the application engine.
export const sum = values => values.reduce((total, value) => total + value, 0);
export const percent = (numerator, denominator) => denominator ? numerator / denominator * 100 : null;

export function forecastMetrics(rows, predictionKey = 'forecast', tolerance = 0.20) {
  const errors = rows.map(row => row[predictionKey] - row.actual);
  const absoluteError = sum(errors.map(Math.abs));
  const nonzero = rows.filter(row => row.actual > 0);
  const within = rows.filter(row => Math.abs(row[predictionKey] - row.actual) <= tolerance * row.actual).length;
  return {
    n: rows.length, MAE: rows.length ? absoluteError / rows.length : null,
    RMSE: rows.length ? Math.sqrt(sum(errors.map(e => e * e)) / rows.length) : null,
    bias: rows.length ? sum(errors) / rows.length : null,
    WAPE_percent: percent(absoluteError, sum(rows.map(row => row.actual))),
    MAPE_nonzero_percent: nonzero.length ? sum(nonzero.map(row => Math.abs(row[predictionKey] - row.actual) / row.actual)) / nonzero.length * 100 : null,
    MAPE_included: nonzero.length, MAPE_excluded_zero_actual: rows.length - nonzero.length,
    within20PercentCount: within, within20PercentScore: percent(within, rows.length),
  };
}

export function classificationMetrics(rows, truthKey = 'shortageWithoutReceipts') {
  const TP = rows.filter(row => row.alert && row[truthKey]).length;
  const TN = rows.filter(row => !row.alert && !row[truthKey]).length;
  const FP = rows.filter(row => row.alert && !row[truthKey]).length;
  const FN = rows.filter(row => !row.alert && row[truthKey]).length;
  const precision = percent(TP, TP + FP), recall = percent(TP, TP + FN);
  const specificity = percent(TN, TN + FP);
  return { n: rows.length, TP, TN, FP, FN, accuracyPercent: percent(TP + TN, rows.length),
    precisionPercent: precision, recallPercent: recall, specificityPercent: specificity,
    F1Percent: percent(2 * TP, 2 * TP + FP + FN),
    balancedAccuracyPercent: recall === null || specificity === null ? null : (recall + specificity) / 2,
    prevalencePercent: percent(TP + FN, rows.length),
    majorityClassBaselineAccuracyPercent: percent(Math.max(TP + FN, TN + FP), rows.length) };
}

// Ground truth: consume earliest-expiring valid stock first, expiring batches at
// start of each day. Shortage means unmet units, not merely hitting a threshold.
export function replayInventory(inventory, future, receipts = []) {
  const batches = inventory.map(row => ({ units: row.available_units,
    expires: Date.parse(row.expiration_date), available: -Infinity,
    usable: row.status !== 'expired' }));
  batches.push(...receipts.map(row => ({ units: row.units, expires: Date.parse(row.expirationDate),
    available: Date.parse(row.actualDate), usable: true })));
  let unmetUnits = 0, wastedUnits = 0, shortageDays = 0;
  const daily = [];
  for (const row of future) {
    const time = Date.parse(row.date.slice(0, 10) + 'T00:00:00Z');
    let needed = row.units;
    for (const batch of batches) {
      if (batch.available <= time && (!batch.usable || batch.expires <= time)) {
        wastedUnits += batch.units; batch.units = 0;
      }
    }
    for (const batch of batches.toSorted((a, b) => a.expires - b.expires)) {
      if (batch.available > time || !batch.usable || batch.expires <= time) continue;
      const take = Math.min(needed, batch.units);
      batch.units -= take; needed -= take;
    }
    unmetUnits += needed;
    if (needed > 0) shortageDays++;
    daily.push({ date: row.date.slice(0, 10), demand: row.units, unmet: needed });
  }
  return { shortage: unmetUnits > 0, unmetUnits, wastedUnits, shortageDays, daily };
}

const location = id => id ? `h:${id}` : 'central';
const priority = request => ({ critical: 3, urgent: 2, normal: 1 })[request.priority] || 1;
const compatibleKey = (loc, row) => `${loc}|${row.blood_type}|${row.component_type}`;
function stateFor(scenario) {
  const stock = {};
  for (const row of scenario.inventory) {
    if (row.status === 'expired' || Date.parse(row.expiration_date) <= Date.parse(scenario.forecastAt)) continue;
    const key = compatibleKey(location(row.hospital_id), row);
    stock[key] = (stock[key] || 0) + row.available_units;
  }
  return stock;
}

// Evaluate raw plan without silently fixing it. A separate safe execution score
// caps invalid transfers; caps are counted as violations in the raw plan score.
export function evaluatePlan(scenario, plan, reserve = 20) {
  const original = stateFor(scenario), stock = { ...original };
  const violations = [], requestResults = [];
  let totalDemand = 0, initiallyCovered = 0, safelyTransferred = 0;
  const expectedIds = scenario.requests.toSorted((a, b) => priority(b) - priority(a)).map(r => r.id);
  if (JSON.stringify(plan.map(row => row.requestId)) !== JSON.stringify(expectedIds)) violations.push('missing_duplicate_or_misordered_requests');
  for (const request of scenario.requests.toSorted((a, b) => priority(b) - priority(a))) {
    const row = plan.find(item => item.requestId === request.id);
    const destination = compatibleKey(location(request.hospital_id), request);
    const covered = Math.min(request.units_requested, original[destination] || 0);
    const need = request.units_requested - covered;
    totalDemand += request.units_requested; initiallyCovered += covered;
    const issues = [];
    if (!row) { issues.push('missing_recommendation'); }
    const suggested = row?.suggestedUnits ?? 0;
    if (!Number.isInteger(suggested) || suggested < 0) issues.push('invalid_quantity');
    if (suggested > need) issues.push('unnecessary_or_excess_transfer');
    const sourceKey = compatibleKey(row?.sourceLocationKey, request);
    const isCentral = row?.sourceLocationKey === 'central';
    const sendable = Math.max(0, (stock[sourceKey] || 0) - (isCentral ? 0 : reserve));
    if (suggested > 0 && row?.sourceLocationKey === location(request.hospital_id)) issues.push('self_transfer');
    if (suggested > sendable) issues.push('unavailable_expired_or_overcommitted_stock');
    if (row && (row.bloodType !== request.blood_type || row.componentType !== request.component_type)) issues.push('incompatible_product');
    const accepted = issues.includes('self_transfer') || issues.includes('incompatible_product') || issues.includes('invalid_quantity')
      ? 0 : Math.min(suggested, need, sendable);
    if (accepted > 0) stock[sourceKey] -= accepted;
    safelyTransferred += accepted;
    violations.push(...issues.map(issue => `${request.id}:${issue}`));
    requestResults.push({ id: request.id, need, suggested, safelyTransferred: accepted, issues });
  }
  return { feasible: violations.length === 0, violations, requestResults, totalDemand,
    initiallyCovered, safelyTransferred, fulfilledWithSafetyCaps: initiallyCovered + safelyTransferred,
    unmetWithSafetyCaps: totalDemand - initiallyCovered - safelyTransferred };
}

// A separately implemented feasible comparator, NOT an optimal or expert oracle.
// It uses valid dates, priority ordering and cumulative stock deduction, and may
// split a request over multiple sources. Immediate, cost-free delivery assumed.
export function greedyFulfillment(scenario, reserve = 20) {
  const original = stateFor(scenario), stock = { ...original };
  let fulfilled = 0;
  for (const request of scenario.requests.toSorted((a, b) => priority(b) - priority(a))) {
    const destination = compatibleKey(location(request.hospital_id), request);
    let need = Math.max(0, request.units_requested - (original[destination] || 0));
    fulfilled += request.units_requested - need;
    const suffix = `|${request.blood_type}|${request.component_type}`;
    const candidates = Object.keys(stock).filter(key => key.endsWith(suffix) && key !== destination)
      .map(key => ({ key, sendable: Math.max(0, stock[key] - (key.startsWith('central|') ? 0 : reserve)) }))
      .sort((a, b) => b.sendable - a.sendable);
    for (const source of candidates) {
      const take = Math.min(need, source.sendable);
      stock[source.key] -= take; need -= take; fulfilled += take;
    }
  }
  return fulfilled;
}

export function prescriptionMetrics(rows) {
  const totalDemand = sum(rows.map(row => row.totalDemand));
  const fulfilled = sum(rows.map(row => row.fulfilledWithSafetyCaps));
  const covered = sum(rows.map(row => row.initiallyCovered));
  const reference = sum(rows.map(row => row.greedyFulfilled));
  return { scenarios: rows.length, feasiblePlans: rows.filter(row => row.feasible).length,
    feasiblePlanPercent: percent(rows.filter(row => row.feasible).length, rows.length),
    totalDemand, fulfilledWithSafetyCaps: fulfilled, initiallyCovered: covered,
    fulfillmentPercentWithSafetyCaps: percent(fulfilled, totalDemand),
    noTransferBaselineFulfillmentPercent: percent(covered, totalDemand),
    greedyReferenceFulfillmentPercent: percent(reference, totalDemand),
    unitsUnmetAfterSafetyCaps: totalDemand - fulfilled,
    unmetUnitReductionVsNoTransferPercent: percent(fulfilled - covered, totalDemand - covered),
    extraUnitsFilledByGreedyReference: reference - fulfilled };
}
