// Manually transcribed from the user-provided PDFs and visually checked.
// These are published aggregates, NOT individual hospital/day observations.
export const provenance = {
  india: {
    file: 'C:/Users/JEPOY/Downloads/12288_2023_Article_1631.pdf',
    doi: '10.1007/s12288-023-01631-8',
    table: 'Table 1, printed page 657 (PDF page 3)',
    period: '2019-10-01 through 2021-12-31; seven unequal phases',
    product: 'Combined PRBC and whole blood; no ABO/Rh breakdown',
  },
  korea: {
    file: 'C:/Users/JEPOY/Downloads/alm-44-3-262.pdf',
    doi: '10.3343/alm.2023.0242',
    table: 'Table 1, Total (N=194) column, printed page 266 (PDF page 5)',
    period: '2019-2020',
    product: 'RBC products; ABO only; daily usage includes transfused AND wasted units',
  },
};

export const india = [
  { phase: 'A', weeklyCollection: 42, weeklyIssued: 39, averageStock: 76, safetyStock: 51 },
  { phase: 'B', weeklyCollection: 30, weeklyIssued: 25, averageStock: 52, safetyStock: 40 },
  { phase: 'C', weeklyCollection: 51, weeklyIssued: 51, averageStock: 92, safetyStock: 66 },
  { phase: 'D', weeklyCollection: 36, weeklyIssued: 34, averageStock: 74, safetyStock: 43 },
  { phase: 'E', weeklyCollection: 30, weeklyIssued: 25, averageStock: 73, safetyStock: 32 },
  { phase: 'F', weeklyCollection: 43, weeklyIssued: 38, averageStock: 75, safetyStock: 39 },
  { phase: 'G', weeklyCollection: 47, weeklyIssued: 49, averageStock: 90, safetyStock: 59 },
];

export const korea = [
  { abo: 'O', averageDailyUsage: 6.1, averageStockIndexDays: 5.4 },
  { abo: 'A', averageDailyUsage: 7.4, averageStockIndexDays: 4.7 },
  { abo: 'B', averageDailyUsage: 5.8, averageStockIndexDays: 5.6 },
  { abo: 'AB', averageDailyUsage: 2.4, averageStockIndexDays: 5.8 },
];
