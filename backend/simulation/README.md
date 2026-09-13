# Controlled Analytics Simulation

This fixture validates BloodConnect's predictive and prescriptive rules without using client data.
It uses a fixed clock (`2026-09-01T12:00:00Z`), six months of deterministic history, known
inventory conditions, pending requests, donors, and four withheld seven-day outcomes.

## Run

From `backend`:

```powershell
npm run test:analytics-simulation
```

The command does not connect to MySQL and does not modify operational data. It imports the same
analytics engine used by the application and writes `simulation/output/validation-report.json`.

## Controlled scenarios

| Scenario | Expected outcome |
| --- | --- |
| O+ whole blood doubles from 30 to 60 units | Increasing, spike, high demand risk, 14-unit seven-day forecast |
| O+ has 20 units, 8 near expiry | 12 usable units, six days remaining, critical shortage |
| A+ remains at 30 units per period | Stable trend and sufficient inventory |
| AB+ falls from 30 to 10 units | Decreasing trend and unusual drop |
| O- has demand but only expired inventory | Critical out-of-stock status and donor/external supply action |
| B+ platelets all expire within seven days | Critical near-expiry-only status |
| A- plasma request with central supply | Dispatch 13 units from Central Inventory |
| O+ plasma available above another hospital's reserve | Transfer 20 units from that hospital |
| A+ platelet request already covered locally | No transfer required |

`expectedResults.json` is the human-reviewable oracle. `controlledData.mjs` contains the inputs and
withheld outcomes. The report includes exact rule checks plus MAE, MAPE, and forecast bias.

Synthetic accuracy proves deterministic behavior under known conditions; it does not replace a
later backtest using real client demand.

## Visual UI test

Set the following in `frontend/.env`, then restart the frontend development server:

```env
VITE_ANALYTICS_SIMULATION=true
```

Open **Admin > Reports & Analytics**. An amber **Simulation Data Active** banner confirms that the
page is using controlled records and a fixed reference date. Set the value to `false` (or remove it)
and restart the frontend to return to live API data.

## Full separate-database test

The database workflow clones the schema only, then inserts controlled data. It always refuses a
target whose name does not end in `_simulation`.

```powershell
cd backend
npm run simulation:db:create
npm run simulation:db:test
```

The default target is the configured source database name plus `_simulation`. Override it with
`SIMULATION_DB_NAME`, but retain the required suffix. To run the full application against it:

```powershell
$env:DB_NAME='bloodconnect_simulation'
$env:SIMULATION_MODE='true'
npm run dev
```

In the frontend terminal, disable the in-browser fixture so the page uses the simulation database:

```powershell
$env:VITE_ANALYTICS_SIMULATION='false'
npm run dev
```

Sign in with `simulation_admin` / `Simulation123!`. These credentials exist only in the disposable
simulation database. Running `simulation:db:create` again drops and recreates only that guarded
simulation database.

`SIMULATION_MODE=true` disables the background SMS, inventory-alert, and event-notification
schedulers while the application is connected to controlled data.

The reviewable database oracle is in `databaseExpectedResults.json`. It lists the expected demand,
shortage status, expiry classification, recommendation order, source, and transfer quantity for
each controlled headline scenario.
