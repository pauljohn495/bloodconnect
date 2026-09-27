# BloodConnect analytics unit, integration, and system testing

## Executive summary

Retest date: **September 26, 2026**

Result: **PASS for the automated tests and served-application smoke checks completed in this environment.**

The earlier functional-consistency summary omitted Donor Availability Insights. That was a real coverage gap: donor records were present in the controlled fixture, but the validation suite did not calculate or assert their availability output. The donor calculation is now a shared analytics function used by both the Reports page and the automated suite.

The retest covers all predictive and prescriptive features currently shown on **Admin > Reports & Analytics**:

- Predictive: blood shortage forecast, blood usage trends, and donor availability insights.
- Prescriptive: donor outreach/campaign recommendations and hospital inventory transfer recommendations.
- Consistency: repeat-run equality, cloned-input equality, and input-mutation detection.

## Result summary

| Level | Result | Evidence |
| --- | --- | --- |
| Unit | PASS | 19/19 analytics logic regression checks |
| Integration | PASS | 128/128 controlled analytics checks; 6/6 API integration checks |
| System smoke | PASS | Production frontend build and lint passed; `/admin/reports` returned HTTP 200; the served report module contains the donor section and shared donor calculation |
| Visual browser | Not executed | The in-app browser runtime was unavailable in this session; no visual-rendering pass is claimed |

## Donor Availability Insights - added coverage

The controlled fixture has four donors and a fixed reference date of September 1, 2026. For the 30-day forecast window, the validated result is:

| Output | Expected and actual |
| --- | --- |
| Registered donors | 4 |
| Eligible now | 2 |
| Newly eligible within 30 days | 1 |
| Newly eligible within 7 days | 0 |
| Can donate within 30 days | 3 (75%) |
| Peak upcoming eligibility month | September (1 donor) |
| Classification | High Availability |
| Prescriptive recommendation | Schedule blood donation drives in September |

Unit cases also verify whole-blood (90-day), platelet (14-day), and plasma (28-day) recovery intervals; missing or invalid last-donation dates; empty donor data; and the difference between 7-day and 30-day windows.

## Integration and consistency details

The controlled analytics flow loads the same fixture and calls the same shared functions used by the Reports page. It checks exact shortage, trend, donor, and transfer outputs against `backend/simulation/expectedResults.json`.

- Fixture integrity: 2/2 passed.
- Output correctness: 120/120 passed.
- Output consistency: 5/5 passed across repeated processing and cloned input.
- Input integrity: 1/1 passed; analytics processing did not mutate the fixture.
- Complete output SHA-256: `728d5cca06d8f198340417d77d726015c960fcd6ccb6b8c1aa3563f88e91c73d`.

## Commands used

From `backend`:

```powershell
npm.cmd test
```

From `frontend`:

```powershell
npm.cmd run lint
npm.cmd run build
```

The detailed machine-readable result is written to `backend/simulation/output/validation-report.json`.

## Interpretation and limitation

A pass means the tested code processes these controlled inputs into the recorded expected outputs and does so consistently. It is not a clinical validation or a real-world predictive-accuracy percentage. The served-application smoke check confirms the route and donor report code are delivered, but visual layout and interaction still require a browser run because the browser runtime was unavailable during this retest.
