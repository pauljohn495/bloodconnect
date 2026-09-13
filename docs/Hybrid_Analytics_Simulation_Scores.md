# BloodConnect: synthetic simulation scores

This is a seeded synthetic benchmark informed by published mean values, not original hospital records or real-world accuracy. The application engine was tested unchanged. No production database was accessed.

## Measured results

| Module / measure | Score |
| --- | ---: |
| Demand: forecasts within +/-20% of simulated next-week usage | 55.33% (1552/2805) |
| Demand: MAE in units per seven-day forecast | 9.51 |
| Demand: RMSE in units per seven-day forecast | 13.52 |
| Demand: WAPE (lower is better) | 23.76% |
| Demand: MAPE on nonzero outcomes (lower is better) | 30.41% |
| Last-week baseline: MAE / WAPE | 10.79 / 26.96% |
| Shortage detection: accuracy, no replenishment | 81.89% |
| Shortage detection: precision / recall / F1 | 76.95% / 96.70% / 85.70% |
| Shortage detection: balanced accuracy | 79.83% |
| Shortage detection: majority-class baseline accuracy | 56.11% |
| Shortage detection: accuracy with delayed receipts | 71.69% |
| Prescriptive: feasible raw transfer plans | 100.00% (540/540) |
| Prescriptive: fulfilled units after externally applied safety caps | 57.04% |
| No-transfer baseline: fulfilled units | 14.71% |
| Feasible split-source greedy comparator: fulfilled units | 63.27% |

Do not average these unlike measures into a single analytics accuracy. No 100-minus-MAPE score is used. The +/-20% tolerance is a declared benchmark choice, not a clinical acceptance standard. MAPE includes 2798 outcomes and excludes 7 zero-usage outcomes; MAE, RMSE, WAPE and tolerance scoring include all cases. Zero actual demand counts within tolerance only when prediction is also zero.

## Data and chronology

- 165 synthetic series x 180 days = 29700 generated daily records; 2805 seven-day forecasts; 540 prescriptive scenarios with 630 pending requests.
- Nominal rate anchors: seven India phase mean weekly issue values divided by seven, and four Korean ABO mean daily usage values. Source details are in the dataset and the earlier Paper_Based_Analytics_Test_Report.md. Other fields and distributions are generated assumptions, not recovered missing hospital records.
- Seeds fixed before scoring: 104729, 130363, 155921. No seeds or parameters were selected to improve scores.
- Each series has 60 days of initial history. Origins then advance seven days; the next seven days are withheld from each forecast. Later origins may use earlier evaluated days as newly available history. Test horizons within a series do not overlap; history windows do overlap, so cases are not statistically independent.
- Engine history consists of synthetic fulfilled requests at noon; forecast origin is midnight. Historical fulfilled usage equals generated demand by assumption (no historical supply censoring). The original engine uses the preceding 30 days; it is not retrained.
- Future data are generated independently of the engine by Poisson draws, weekday multipliers, demand shocks, level shifts, and intermittent zero demand. Exact parameters and random streams are in generateHybridEvaluation.mjs and the dataset protocol.
- Every input quantity is a nonnegative integer. Independent assertions check chronology, seven-day horizons, deterministic generation, scoring formulas, and inventory expiry/arrival behavior.
- Generated whole-blood records are numerical surrogates. Original red-cell labels remain unsupported. India uses a test-only ALL_UNSPECIFIED grouping; Korea uses unsigned ABO. Neither actual Rh proportions nor other component behavior is validated. Korean anchor usage originally includes waste, so these rates are only scale references, not validated patient-demand estimates.

## Forecast scores by pattern

| Pattern | Cases | Demand MAE | Demand WAPE | Within 20% | Shortage accuracy (no receipts) |
| --- | ---: | ---: | ---: | ---: | ---: |
| stationary | 561 | 5.31 | 14.14% | 71.48% | 86.45% |
| weekday_cycle | 561 | 5.48 | 14.59% | 70.05% | 83.60% |
| demand_spikes | 561 | 9.55 | 21.32% | 54.19% | 85.20% |
| level_change | 561 | 12.69 | 29.76% | 47.42% | 79.14% |
| intermittent | 561 | 14.50 | 38.69% | 33.51% | 75.04% |

## Shortage definition and limitations

An alert is a current engine status of critical, critical_out, near_expiry_only or at_risk. A true shortage means any unmet generated usage during the next seven days in an independent daily inventory replay. The replay expires batches at the start of each day and consumes earliest-expiring usable batches first. It does not use the engine's days-of-stock formula to label outcomes.

No-replenishment confusion matrix: TP=1522, TN=775, FP=456, FN=52. Shortage prevalence is 56.11%. The separate delayed-receipts evaluation uses the same forecast alerts against replayed receipt outcomes; the current engine has no receipt input, so this is an operational stress test, not a supported supply-aware forecast.

Inventory snapshots are independently generated for each origin, at 2/5/8/14 nominal days of stock with variation, split into a near-expiry batch and a later-expiry batch. They are not one continuous hospital inventory ledger. Replenishment occurs in a designed 60% probability of cases, with a 35% probability of a three-day delay when planned. These are assumptions, not measured hospital frequencies.

Historical trend-label rule agreement was 2805/2805; this is descriptive formula correctness, NOT future trend accuracy.

## Prescriptive scoring

| Scenario family | Feasible plans | Feasibility score | Fulfillment after safety caps |
| --- | ---: | ---: | ---: |
| routine | 90/90 | 100.00% | 100.00% |
| already_covered | 90/90 | 100.00% | 100.00% |
| competing_requests | 90/90 | 100.00% | 69.99% |
| stale_expired | 90/90 | 100.00% | 0.00% |
| fragmented_supply | 90/90 | 100.00% | 56.35% |
| no_supply | 90/90 | 100.00% | 0.00% |

The feasibility score requires a complete priority-ordered plan with integer nonnegative units, no incompatible or self transfers, no transfers beyond the destination's unmet need, no expired supply, and cumulative source deductions that preserve the 20-unit hospital reserve (central stock has no reserve). These are explicit software constraints, not clinician-approved recommendations. Scenario families are deliberately equally weighted stress tests, not a representative hospital case mix.

Already-covered requests with positive suggestions, independently overcommitted source stock, and date-expired stock with stale available status remain failures; they are not repaired before scoring. Fulfillment is a separate hypothetical outcome after an external evaluator rejects or caps unsafe transfers. This external safety layer is NOT installed in the app and must not be presented as existing engine behavior.

The no-transfer baseline uses valid destination stock only. The greedy comparator independently applies priority order, cumulative available-stock deductions, expiry checks, and multiple sources when needed. It is a feasible heuristic, not an optimal or expert oracle. Immediate cost-free transfers and exact blood-group/component matching are assumed. Transport times, crossmatching, clinical suitability, donor selection, and future recipient expiry/wastage are not evaluated. The benchmark does not validate all possible prescriptive functions.

## Reproduce and audit

Run: `node backend/scripts/evaluateHybridAnalytics.mjs` from the repository root. A successful exit means the evaluator completed and its internal checks passed, not that the application met an acceptance threshold. This is an evaluation run with no declared clinical pass/fail threshold.

Artifacts under `backend/simulation/output/hybrid-evaluation/`:

- `synthetic-dataset.json`: all generated input records, dates, outcomes, source provenance and protocol.
- `scores.json`: aggregate, per-pattern, per-seed and per-family scores; source hashes.
- `case-results.json`: every prediction/outcome, raw recommendation and violation.

Dataset SHA-256 (compact JSON before final newline): `be037b17b26714d10aa890331e8bb42d432b379083a3df73efe8f5e58a0b2134`.

Forecast metric definitions and holdout rationale: [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html). Classification metric definitions: [scikit-learn model evaluation documentation](https://scikit-learn.org/stable/modules/model_evaluation.html). These sources support measurement definitions, not the validity of the synthetic clinical assumptions.

## Suggested capstone statement

BloodConnect was evaluated using seeded synthetic scenarios informed by published aggregate blood usage statistics. Seven-day usage forecasts had MAE 9.51 units and WAPE 23.76%; 55.33% were within 20% of simulated usage. Seven-day shortage detection achieved 81.89% accuracy and 85.70% F1 under no replenishment. 100.00% of constructed transfer plans satisfied all tested constraints. Results are conditional on the simulation design and do not establish real-world predictive accuracy or clinical effectiveness.
