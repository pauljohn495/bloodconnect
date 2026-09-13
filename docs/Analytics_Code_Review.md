# Analytics logic review - 9 September 2026

## Scope and evidence

Reviewed the current frontend analytics engine, reports-page integration, admin inventory/request data flow, and separate backend wastage controllers. Ran 13 focused reproductions with `node tmp/review_analytics_logic.mjs`. Backend controller functions were executed with mocked query results in an isolated JavaScript context, without connecting to a database. The SQL aggregation finding below is static analysis, not a live query test. No application logic or database was modified.

Earlier synthetic benchmark scores applied to the three frontend engine functions, NOT the separate backend wastage controllers, donor-contact rules, or deployed application end to end. This review does not recalculate those scores.

## High-priority findings

### Source and destination stock are reused across transfer recommendations

`frontend/src/admin/analyticsEngine.js:185-235` constructs one initial stock map, then independently maps requests. It never deducts allocations at either end. Source 76 with reserve 20 and two 39-unit requests yields suggestions totaling 78 although only 56 are sendable. Destination stock 52 with two 39-unit requests yields two already-covered messages, although total unmet need is 26. Sorting results by priority after calculation does not allocate stock by priority.

Recommended fix: sort requests before allocation, maintain mutable source and destination budgets, and consume them as each request is evaluated. Test both multiple destinations sharing a source and multiple requests sharing a destination. Clarify whether requested units represent gross clinical requirement or an already-net external procurement need before subtracting destination on-hand stock.

### Empty inventory can remove the shortage alert entirely

`frontend/src/admin/analyticsEngine.js:67` generates rows only from stock keys. A blood group/component with recent delivered usage but no inventory row produces no shortage row. Reproduction: 30 used units and empty inventory returns zero rows. Build rows from the union of usage keys and inventory keys (and explicitly supported request-only risks if required), defaulting missing stock to zero.

### Usage is assigned to request date, and completed-status mapping is inconsistent

`frontend/src/admin/analyticsEngine.js:28-41,129-137` accepts delivered/received status but uses request_date rather than delivered_at. A request created 40 days ago and delivered yesterday contributes zero current-period units. Meanwhile, the request workflow permits `fulfilled` and `partially_fulfilled` states (`backend/controllers/adminTransferRequestController.js:34-36`), which the frontend usage functions ignore.

Use actual fulfillment/issue events and quantities if the target is delivered usage. If request-date demand is intended, do not condition historical demand only on currently delivered requests, and label it correctly. Define the meaning of fulfilled/partial states and include their actual issued quantities consistently. The transfer writer can retain previously approved quantities through COALESCE; approved quantities are not necessarily a verified event-level usage ledger. Deliveries to a hospital also do not by themselves prove patient consumption.

### Backend partial requests are permanently skipped

`backend/controllers/adminAnalyticsController.js:312` marks a request processed after any positive transfer, even if only partly satisfied. With batches of 5 and 10 and one request for 12, it recommends only 5. Track remaining request quantities and continue across batches until satisfied or stock is exhausted.

### Backend scarcity allocation does not honor clinical request priority

`backend/controllers/adminAnalyticsController.js:288` orders matching requests by date alone; its eventual result sort is by expiry-derived priority. With one five-unit batch, an older normal request receives all five and a newer critical request receives none. If critical-first is the required policy (as elsewhere in this application), order requests by priority then date BEFORE allocating stock, while keeping earliest-expiry batch selection.

## Other confirmed issues and conditional risks

### Covered request still shows nonzero suggested units

`frontend/src/admin/analyticsEngine.js:217` falls back to unitsRequested when unitsNeeded is zero. Destination 52, request 39 and another source with 76 produces an already-covered message plus 39 suggested units. The reports page displays this field at `frontend/src/admin/admin-reports.jsx:1269`. Return zero quantity and no transfer source when no transfer is needed.

### Engine relies on expiry status without validating expiration date

`frontend/src/admin/analyticsEngine.js:185` excludes only status exactly equal to expired. A batch dated 2000-01-01 but marked available still produces a 39-unit suggestion. Add explicit date eligibility and a supplied reference clock. Invalid dates should not silently become usable stock.

Qualification: `backend/controllers/adminInventoryController.js:83-100` normally marks past-expiry rows expired during inventory fetch, reducing exposure on a fresh reports load. The reproduction is a defensive engine failure with stale/inconsistent input, not evidence that every normal page load includes expired stock. Reports fetch once on mount, so long-lived pages can become stale. Define whether date-only expiry is valid through the day; frontend and backend currently use different boundary approaches.

### Unsupported product labels silently become whole blood

`frontend/src/admin/analyticsEngine.js:3-7` preserves only platelets/plasma and maps all other input, including red_blood_cells, to whole_blood. Reject unknown components or implement explicit supported mappings. This is material for importing the papers' RBC records; it is not evidence that current UI-only supported values are all misclassified.

### Invalid usage quantities corrupt shortage calculations

`frontend/src/admin/analyticsEngine.js:41` converts but does not validate finite nonnegative quantities, unlike usage-trend filtering. With -30 units and stock 76, days remaining is -76. Validate inventory, request quantities and positive finite window lengths at a shared boundary. This is a malformed-input resilience defect; the review did not establish that production data contains negative quantities.

### Backend numeric aggregation can concatenate strings

`backend/controllers/adminAnalyticsController.js:75` adds total_demand without Number conversion. Mocked values '10' and '10' change demandRiskFactor from 5 to 20 compared with numeric 10 and 10. The configured mysql2 driver defaults decimalNumbers to false; SUM values can be strings. Normalize aggregate result types explicitly before arithmetic, and add numeric-string regression tests.

### Remaining near-expiry units can disappear from alerts

`backend/controllers/adminAnalyticsController.js:377-382` excludes any batch already referenced in a transfer recommendation. With 10 units expiring in five days and a request for 5, the remaining 5 produce no near-expiry action. Determine the alert from remaining positive quantity, not from whether any recommendation references that batch.

### Low-demand SQL can multiply both stock and request totals (static finding)

`backend/controllers/adminAnalyticsController.js:340-359` joins inventory rows directly to request rows and then sums both sides. Multiple rows on either side inflate the other side's aggregate. Example: two ten-unit batches and two one-unit requests generate four joined rows, summing stock to 40 instead of 20 and demand to 4 instead of 2. This can trigger the >30 inventory / <5 demand reduction rule incorrectly. Aggregate stock and requests separately per blood group/component before joining. No live SQL execution was performed.

## Modeling and maintainability improvements (not all are coding bugs)

- Treat the current demand forecast as a rolling-average baseline, not trained ML. Evaluate alternatives on independent time-ordered data; do not tune seeds or expected outcomes to improve scores.
- Define the target: requested demand, issued units, transferred units and patient consumption differ. Use the proper event ledger and handle partial deliveries rather than treating approval quantities as actual usage.
- Distinguish no history from true zero demand. When the prior window is zero, the current code reports 100% growth; mathematically percentage growth is undefined. Show new activity / insufficient baseline instead.
- Replace wholesale exclusion of all soon-expiring units with a daily depletion/expiry replay if the feature intends a realistic stockout forecast. The current rule is conservative, not a precise depletion model. Add replenishment only with reliable receipt schedules and uncertainty handling.
- Scope stock/usage by hospital when reporting hospital-specific shortages. Current frontend shortage grouping pools locations by blood type/component.
- Make reserve rules configurable for approved operational policy; support multiple sources where necessary. Single-source recommendations can leave demand unmet even with sufficient combined supply.
- Backend wastage forecasts use a fixed 0.15 multiplier and heuristic risk scores as probabilities. These are uncalibrated estimates; do not present them as validated probabilities of actual wastage.
- Remove duplicated legacy calculations still executed and discarded in admin-reports.jsx (lines 265/328, 387/440, 755/827). Keep one authoritative implementation and shared input validation.
- Donor/expiry suggestions on the reports page also aggregate across components in places. Do not treat stock in one component as automatically covering another component's shortage. These ancillary paths were inspected but not fully regression-tested in this review.
- Enforce eligibility, quantity, expiry and stock reservation again at execution time on the server. A recommendation is not a stock reservation and can become stale.

## Recommended order

1. Define usage/fulfillment semantics and repair quantity/date/status mapping.
2. Fix cumulative source/destination allocation, missing-stock alerts, and partial request handling.
3. Correct expiry validation, zero-needed quantities, numeric types and SQL aggregates.
4. Add regression tests including the reproduced failures; test frontend and backend separately.
5. Rerun the same unchanged benchmark with before/after engine fingerprints. Improve forecasting models only after correctness and data meaning are established.

The review leaves all application fixes unimplemented, as requested scope was inspection and advice.
