# BloodConnect: paper-based controlled analytics tests

## Outcome

The existing analytics engine was executed against controlled numerical fixtures built from published aggregate values in the two supplied papers. This is **published-data-informed functional testing**, not validation against original daily hospital observations. No real-world forecast accuracy, MAPE, shortage classification accuracy, or recommendation effectiveness can be established from these PDFs alone.

| Test category | Passed | Failed | Interpretation |
| --- | ---: | ---: | --- |
| Blood Demand & Usage Trends arithmetic | 11 | 0 | Correct calculations on constructed constant-rate histories |
| Blood Shortage Forecast arithmetic | 11 | 0 | Correct days-of-stock calculations and configured status rules on hypothetical snapshots |
| Prescriptive recommendation scenarios | 3 | 3 | Three functional/safety invariants failed |
| Red-cell component compatibility | 0 | 2 | Both tested red-cell labels silently normalize to whole blood |

Counts are test-case results, not statistical accuracy estimates. Cases are small, deliberately selected, and not independent samples of clinical operations. Passing arithmetic tests does not establish that the rules themselves predict future events well.

## Sources and transcription

1. Bansal et al. *Blood Inventory Management During COVID-19 Pandemic Using a Simple Mathematical Tool: A Two-Year Study from a Tertiary Care Hospital in North India*. DOI: [10.1007/s12288-023-01631-8](https://doi.org/10.1007/s12288-023-01631-8). Local file: `C:/Users/JEPOY/Downloads/12288_2023_Article_1631.pdf`. Table 1, PDF page 3 / printed page 657. Seven phase-level means cover October 2019 through December 2021. PRBC and whole blood are combined; no ABO/Rh breakdown is supplied in the table.
2. Park et al. *Optimizing the Hospital Blood Bank Stock in Korea: A Comparative Analysis of the Uniform 5-Day Stock Index and a Novel Blood Stock Index*. DOI: [10.3343/alm.2023.0242](https://doi.org/10.3343/alm.2023.0242). Local file: `C:/Users/JEPOY/Downloads/alm-44-3-262.pdf`. Table 1, PDF page 5 / printed page 266, Total (N=194) column. Four ABO mean daily usage values cover 2019-2020. RhD is unspecified. Usage includes both transfused and wasted RBC units, not solely patient demand.

The PDF skill's visual-verification workflow was used: relevant table pages were rendered and checked against the manually transcribed fixture values. No raw hospital/day dataset is embedded in either supplied PDF.

## Method and explicit assumptions

- The script imports the same three functions used by `frontend/src/admin/admin-reports.jsx` from `frontend/src/admin/analyticsEngine.js`. This is a direct engine test, not an end-to-end browser, API, database, or deployment test.
- Indian weekly issue means are divided by seven. Korean daily means are used directly. Each rate is distributed across an artificial 30-day history, with fractional units retained for numerical testing. These are not actual daily transactions.
- Indian phases B-G use the preceding phase mean in an artificial previous 30-day window. Phase A uses an identical previous window. Actual phases have unequal durations: these tests do not reconstruct their time series.
- Korean histories use identical prior/current windows. Their stable labels are constructed, not findings about Korean temporal trends.
- India's average inventory values are treated as hypothetical point-in-time stocks. Korea's stocks are constructed as five times mean daily usage. We do not infer mean stock by multiplying mean usage and mean stock index; that would not generally be valid.
- For isolated numerical checks, inputs deliberately use the supported `whole_blood` component as a test surrogate. The original product identities remain recorded in the source fixture. This does not authorize relabeling actual RBC records or establish component-level validity.
- `ALL_UNSPECIFIED` is an artificial grouping key for Indian aggregates. Korean ABO labels remain unsigned; no Rh values are invented.
- The shortage fixtures assume no expiring units and no replenishment. The expected statuses follow BloodConnect's current cutoffs, not the papers' safety-stock policies or observed shortage events.
- Transfer destinations, source identities, pending requests, priorities, and expiry conditions are invented test scenarios. Published means supply only their numerical scale. India's phases are not treated as actual different hospitals.
- The engine, application configuration, and database were not changed. Only a standalone fixture, test runner, result artifact, and this report were added.

## Demand and shortage numerical results

All values below are scenario outputs, not retrospective clinical predictions. Seven-day demand is the constructed daily rate multiplied by seven. Days remaining are hypothetical stock divided by the constructed daily rate.

| Case | 7-day usage estimate (units) | Constructed trend | Scenario stock (units) | Days remaining | Engine status |
| --- | ---: | --- | ---: | ---: | --- |
| India A | 39.0 | Stable | 76 | 13.64 | Low |
| India B | 25.0 | Decreasing | 52 | 14.56 | Sufficient |
| India C | 51.0 | Increasing | 92 | 12.63 | Low |
| India D | 34.0 | Decreasing | 74 | 15.24 | Sufficient |
| India E | 25.0 | Decreasing | 73 | 20.44 | Sufficient |
| India F | 38.0 | Increasing | 75 | 13.82 | Low |
| India G | 49.0 | Increasing | 90 | 12.86 | Low |
| Korea O | 42.7 | Stable | 30.5 | 5.00 | Critical |
| Korea A | 51.8 | Stable | 37.0 | 5.00 | Critical |
| Korea B | 40.6 | Stable | 29.0 | 5.00 | Critical |
| Korea AB | 16.8 | Stable | 12.0 | 5.00 | Critical |

Example: India's phase A reports average weekly issue of 39 and average inventory of 76. The constructed rate is 39/7 = 5.5714 units/day. The engine returns a seven-day estimate of 39 and 76/(39/7) = 13.6410 days of stock. Returning the input mean is a formula check, not a comparison with unseen demand. Reporting MAPE = 0 for this comparison would be misleading.

## Prescriptive results and failures

| Constructed scenario | Expected | Actual | Result |
| --- | --- | --- | --- |
| One request: source 76, reserve 20, request 39 | Transfer 39 and preserve reserve | Transfer 39 | Pass |
| Central stock 76; request ceil(6.1 x 7) = 43 | Dispatch 43 | Dispatch 43 | Pass |
| No available source; request 39 | Zero units; external-supply recommendation | Matches | Pass |
| Destination already has 52; request 39; another source has 76 | Zero transfer units | Says already covered, but suggests 39 units | Fail |
| Two destinations each request 39 from source stock 76 with reserve 20 | Combined suggestions at most 56 | Combined suggestions 78 | Fail |
| Source stock 76 has expiration date 2000-01-01 but stale available status | Do not suggest expired stock | Suggests 39 units | Fail |

The last test examines defensive behavior with inconsistent inventory metadata. It does not establish that the deployed database currently contains such records. The test covers engine behavior only.

The shared-source failure occurs because recommendations are generated independently without deducting stock already recommended to another request. Priority sorting does not resolve that stock-allocation issue. The covered-request failure concerns the nonzero `suggestedUnits` value despite an already-covered message. The expiration failure occurs because the transfer engine filters expired status but does not check the expiration date.

Two additional compatibility probes using `packed_red_blood_cells` and `red_blood_cells` both return `whole_blood`. The current normalizer defaults all unrecognized components to whole blood. The papers' component data therefore cannot be faithfully imported unchanged. No fix was made because the request was to test the system.

## Research interpretation

Suggested capstone wording:

> Published aggregate blood usage and inventory values from two studies were used to construct controlled test scenarios for BloodConnect. All 11 demand/usage arithmetic cases and 11 shortage arithmetic cases passed. Three of six prescriptive scenario checks passed; failures concerned unnecessary suggested transfer quantities, shared-stock overcommitment, and date-expired inventory with stale status. Two red-cell component compatibility checks failed. These results evaluate selected software calculations and constraints, not real-world predictive accuracy or clinical effectiveness.

An actual accuracy study still requires chronologically ordered usage records, stock snapshots and appropriate shortage outcomes. Inputs must match the forecast target: fulfilled usage, total demand, and wastage are not interchangeable. For seven-day forecasts, generate each prediction using only preceding information and compare it with the next seven days; do not use the same aggregate to construct inputs and grade outcomes. Evaluate recommendation feasibility and operational benefit separately using an explicit baseline, constraints, and independent outcomes or expert assessment. The PDF studies' own statistics cannot be reported as BloodConnect's performance.

## Reproduction

Run from the repository root:

```powershell
node backend/scripts/testPaperBasedAnalytics.mjs
```

The command intentionally exits with code 1 while failures remain. It does not connect to a database or network. It writes detailed results to `backend/simulation/output/paper-based/results.json`, including source provenance, assumptions, expected-check failures, actual outputs, and a SHA-256 fingerprint of the engine version tested. Genuine accuracy metrics are explicitly null because their required ground truth is missing.

Fixture: `backend/simulation/paperPublishedData.mjs`.
