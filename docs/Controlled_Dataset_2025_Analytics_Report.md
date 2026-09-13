# BloodConnect controlled-dataset analytics test

## Executive summary

This report evaluates the current BloodConnect analytics engine on the supplied **Controlled Synthetic Historical Blood Inventory and Utilization Dataset** for 2025. It is a software-validation result, not evidence of real-world clinical accuracy.

| Measure | Result |
| --- | ---: |
| Independent data-integrity checks | 18/18 passed |
| Seven-day demand forecasts | 6,768 |
| Demand MAE | 0.93 units |
| Demand RMSE | 1.33 units |
| Demand WAPE | 16.36% |
| Demand MAPE (nonzero actuals) | 26.72% |
| Forecasts within ±20% | 51.99% (3519/6768) |
| Shortage classification accuracy | 78.19% |
| Shortage precision / recall / F1 | 50.87% / 36.99% / 42.84% |
| Shortage balanced accuracy | 63.43% |
| Prescriptive feasible plans | 100.00% (47/47) |
| Pending demand covered after recommendations | 88.68% |
| Pending demand covered without transfers | 87.83% |
| Expected scenario forecast reproduction | 93.33% (14/15) |
| Expected-scenario condition detection | 71.43% (10/14) |

There is no defensible single combined “predictive and prescriptive accuracy” because demand error, shortage classification, condition detection, and plan feasibility measure different outcomes. Lower MAE/RMSE/WAPE/MAPE is better; higher classification and scenario-detection scores are better.

Compared with the previous shortage rule, classification accuracy changed from 65.82% to 78.19%, while false alerts fell from 1702 to 534. The stricter critical-alert policy intentionally moves uncertain cases to a yellow monitoring state, so recall must be reviewed alongside the false-alert reduction.

## Test protocol

- Dataset period: 2025-01-01 through 2025-12-31; six hospitals, eight blood groups, and three components.
- Each demand forecast uses only the preceding 30 days of fulfilled usage. Shortage risk additionally uses requested demand and recent under-fulfillment. The following seven days are withheld and used as ground truth.
- Origins advance by seven days, yielding 6,768 forecasts without overlapping future horizons within a series.
- The engine is tested per hospital because the supplied scenario labels are hospital-specific. Hospital IDs H001–H006 are mapped to numeric IDs 1–6 without changing their identities.
- Shortage truth is positive when requested units exceed fulfilled units at least once over the hidden seven-day horizon. Only critical, out-of-stock, and unusable-near-expiry states count as confirmed alerts; low and uncertain states remain visible monitoring warnings.
- The last-seven-day naive forecast is included as a comparator: MAE 1.07 units and WAPE 18.78%.
- For the prescriptive stress test, each hidden seven-day requested total is converted into a pending request only after forecast scoring. This tests plan constraint feasibility and potential coverage over 47 weekly snapshots; it is not a claim that future requests were available to the prediction model.

## Confusion matrix for seven-day shortage detection

| | Actual shortage | No actual shortage |
| --- | ---: | ---: |
| Engine alert | 553 (TP) | 534 (FP) |
| No engine alert | 942 (FN) | 4739 (TN) |

The shortage prevalence was 22.09%; the majority-class baseline accuracy was 77.91%. Accuracy should therefore be interpreted together with recall, F1, and balanced accuracy.

## Controlled scenario results

| ID | Expected condition | Detected | Expected 7-day forecast | Engine forecast | Forecast match |
| --- | --- | :---: | ---: | ---: | :---: |
| S001 | Normal Supply | No | 16.80 | 2.80 | No |
| S002 | Increasing Demand | Yes | 24.73 | 24.73 | Yes |
| S003 | Demand Spike | No | 14.70 | 14.70 | Yes |
| S004 | Shortage | Yes | 7.00 | 7.00 | Yes |
| S005 | Shortage | Yes | 21.47 | 21.47 | Yes |
| S006 | Out of Stock | Yes | 8.17 | 8.17 | Yes |
| S007 | Overstock | Yes | 12.13 | 12.13 | Yes |
| S008 | Near Expiry | Yes | 11.20 | 11.20 | Yes |
| S009 | Transfer Opportunity | No | 7.00 | 7.00 | Yes |
| S010 | Transfer Opportunity | No | 12.83 | 12.83 | Yes |
| S011 | Shortage | Yes | 14.23 | 14.23 | Yes |
| S012 | Wastage Risk | Yes | 0.70 | 0.70 | Yes |
| S013 | No Recent Usage | Yes | 0.70 | 0.70 | Yes |
| S014 | Unknown / At Risk | Yes | 0.47 | 0.47 | Yes |
| S015 | Reduced Supply | N/A | 24.03 | 24.03 | Yes |

Forecast reproduction uses the numeric expected values embedded in the supplied scenario file and a ±0.011-unit rounding tolerance. S001 is expected to differ because only five prior days exist: the dataset's expected value annualizes those five available days, while the application intentionally divides by a fixed 30-day window.

The condition score measures agreement with labeled **conditions**, including transfer-source matching for the two source scenarios. It does not claim that free-text operational recommendations have been clinically validated. The “Reduced Supply” condition is excluded because the current predictive engine accepts inventory and fulfilled usage but does not accept donation/supply-rate history.

## Data-integrity verification

- PASS — inventory row count: 52560/52,560
- PASS — usage row count: 52560/52,560
- PASS — supply row count: 52560/52,560
- PASS — request IDs unique: 33017 requests
- PASS — blood-unit IDs unique: 49190 units
- PASS — daily inventory keys unique: 52560 daily keys
- PASS — daily usage keys unique: 52560 daily keys
- PASS — daily supply keys unique: 52560 daily keys
- PASS — inventory arithmetic: opening + received - fulfilled - expired = closing
- PASS — nonnegative inventory: all inventory measures >= 0
- PASS — usage quantity constraints: transfused <= fulfilled <= requested
- PASS — request quantity constraints: fulfilled <= requested
- PASS — day-to-day inventory continuity: 0 mismatches
- PASS — request totals reconcile to usage: daily requested and fulfilled totals
- PASS — supply reconciles to inventory receipts: daily units received
- PASS — blood-unit chronology: 0 invalid date sequences
- PASS — unit usage reconciles to inventory: unit used dates vs fulfilled units
- PASS — unit expirations reconcile to inventory: unit expired dates vs expired units

## Important limitations

- The dataset is controlled and synthetic, generated with a disclosed fixed seed. Scores can validate software behavior against known patterns but cannot establish real-hospital performance.
- Fulfilled usage is censored during shortages, so a demand model trained only on fulfilled quantities can underestimate unmet clinical demand.
- Aggregate near-expiry counts were represented as separate inventory batches for testing because the frontend engine expects batch-level expiration dates.
- The shortage module does not model future donations or transfers. The December reduced-supply condition is therefore unsupported by the current feature inputs.
- Prescriptive recommendations still use a heuristic and do not model transport time, crossmatching, clinical suitability, or future replenishment.

## Reproduction

From the repository root:

`node backend/scripts/evaluateControlledDataset2025.mjs "C:/Users/JEPOY/Downloads/BloodConnect_1Year_Controlled_Dataset_2025"`

Machine-readable scores and case-level forecast results are stored under `output/controlled-dataset-2025/`.
