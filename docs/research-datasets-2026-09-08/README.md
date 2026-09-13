# Public blood-demand datasets: acquisition and suitability review

Retrieved on 2026-09-08 for BloodConnect capstone research. Source data files are preserved without cleaning, invented blood types, inferred daily observations, or import into the application database. No predictive accuracy has been calculated on these datasets.

## 1. Zhejiang Provincial Blood Center, China

Local file: `Zhejiang_Data_Sheet_1.csv`

Source publication: Wang G, Pu X, Anyosa RJCC, and Gu Y (2026). The impact of COVID-19 on blood supply–demand balance and the association between group donations and economic performance: evidence from Zhejiang, China. Frontiers in Public Health 14:1739767.

- Article: https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2026.1739767/full
- DOI: https://doi.org/10.3389/fpubh.2026.1739767
- Supplementary CSV listing: https://pmc.ncbi.nlm.nih.gov/articles/PMC12950710/#supplementary-material
- Downloaded supplementary archive: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12950710/supplementaryFiles
- Archive member extracted: `Data_Sheet_1.CSV`
- Local archive: `Zhejiang_supplementary.zip`

The study attributes these data to the provincial blood center; they are reported observational data, not a synthetic test fixture. They should be described as reported blood demand and supply, not assumed to be patient transfusions. The operational definition of demand and the unit/component definitions require confirmation before interpreting errors as units consumed by patients.

The CSV contains 639 rows and 29 columns. Its first and last row dates are 2012-03-19 and 2024-06-17. The article describes an analysis period of 2014-01-01 to 2023-12-15; the released file extends beyond that period.

Useful columns:

- `date`
- `demand_total`, `demand_A`, `demand_B`, `demand_O`, `demand_AB`
- `supply_total`, `supply_A`, `supply_B`, `supply_O`, `supply_AB`
- Collection and donor-group aggregates
- Separate platelet collection and platelet supply fields (not platelet-demand fields)

Read-only quality checks:

- Parsing date strings explicitly as month/day/year succeeds, but 13 rows repeat an existing date (626 distinct dates).
- The ordered records contain nonweekly intervals, backward jumps, and apparent year/date errors. These require source clarification or a documented, defensible selection of valid periods; sorting or automatically deleting duplicates would not resolve the underlying problem.
- All five demand columns are populated; total demand equals the sum of the four ABO demand columns in every row.
- `team_total` is blank in 26 records.
- Total demand has no zero-valued rows. That does not imply every other numeric field is complete or every reporting period is valid.
- Decimal quantities occur in some supply/collection fields, so do not round them into bag counts without confirming unit definitions.

BloodConnect suitability:

- A candidate for a separate weekly ABO-level demand benchmark after the date and variable-definition issues are resolved.
- Weekly totals do not support exact reconstruction of the current rolling 30-day usage input. A four-week average is a different benchmark and must be labelled as an adaptation.
- No Rh factor. Do not convert A to A+, O to O+, or invent negative-group splits.
- No inventory snapshots, batch expiration dates, facility-specific requests, or request priorities.
- Supply is a flow, not stock on hand; do not map `supply_total` to `available_units`.
- Not sufficient to establish observed shortage-date accuracy or correctness of hospital transfer recommendations.
- BloodConnect currently recognizes whole blood, plasma, and platelets. Do not assign an unspecified blood-demand column to whole blood or map packed red cells to whole blood without a justified schema change.

`Zhejiang_Data_Sheet_2.csv` contains economic/health-system covariates, rather than the inventory history missing above. It is included only as the companion source file.

## 2. Tema General Hospital, Ghana

Local file: `Tema_monthly_blood_demand_supply.csv`

Source publication: Twumasi C and Twumasi J (2022). Machine learning algorithms for forecasting and backcasting blood demand data with missing values and outliers: a study of Tema General Hospital of Ghana. International Journal of Forecasting 38(3), 1258–1277.

- DOI: https://doi.org/10.1016/j.ijforecast.2021.10.008
- University publication record: https://orca.cardiff.ac.uk/id/eprint/146317/
- Author repository: https://github.com/twumasiclement/TimeSeries-Forecasting
- Direct CSV: https://raw.githubusercontent.com/twumasiclement/TimeSeries-Forecasting/master/Blood_data_Tema.csv

The paper explicitly identifies this repository as containing the empirical hospital data used in the study.

The file contains 93 monthly records, January 2013 through September 2020, and four columns: `YEAR`, `MONTH`, `QTY_DEMANDED`, `QTY_SUPPLIED`. Demand is missing in 13 months; supply is missing in 9 months. The study addresses missing values and outliers; keep observed values distinct from any later imputations.

Suitable for a separate monthly aggregate demand forecasting exercise. It does not contain daily demand, ABO/Rh groups, component detail, inventory balances, expiration dates, or individual requests. It cannot directly validate BloodConnect's 7-day, blood-type/component-specific forecasts. Do not create apparently observed daily usage by dividing monthly totals by the number of days.

The article's open-access license should not be assumed to be a separate blanket dataset license: cite the authors and repository, and confirm reuse terms if redistributing or publishing a modified dataset.

## A closer match that requires a data-access request

Motamedi M, Dawson J, Li N, Down DG, Heddle NM (2024). Demand forecasting for platelet usage: From univariate time series to multivariable models. PLOS ONE 19(4):e0297391.

https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0297391

The study describes daily platelet transfusions for four Hamilton hospitals from 2010 to 2018, with product/receipt/expiry information and patient ABO/Rh information. Verify that the released data would distinguish product blood group from recipient blood group. Its data-availability statement says the data cannot be publicly released and directs eligible researchers to the Hamilton Integrated Research Ethics Board (https://hireb.ca/). No request has been sent, and no access has been obtained.

## Suggested research approach

For direct validation of the existing system, obtain anonymized daily fulfilled requests or issues by ABO/Rh and component from the capstone partner. Combine them with inventory snapshots, expiry/batch records, and dated receipt/transfer/wastage records for depletion-outcome evaluation. Prescriptive evaluation also requires pending requests, destinations, urgency, and independently reviewed expected decisions.

The public files in this folder are supplementary research candidates. Neither is an exact replacement for that operational dataset. A public-data benchmark adapted to weekly or monthly aggregation must be reported separately from the current application's forecast accuracy and from controlled functional-test results.
