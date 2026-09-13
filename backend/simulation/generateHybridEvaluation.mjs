// Synthetic records informed ONLY in numerical scale by published aggregates.
// Deliberately independent of analyticsEngine.js: never uses its predictions.
import { india, korea, provenance } from './paperPublishedData.mjs';

export const protocol = {
  version: 1, seeds: [104729, 130363, 155921], days: 180, warmupDays: 60,
  horizonDays: 7, strideDays: 7, withinTolerance: 0.20,
  patterns: ['stationary', 'weekday_cycle', 'demand_spikes', 'level_change', 'intermittent'],
  prescriptionFamilies: ['routine', 'already_covered', 'competing_requests', 'stale_expired', 'fragmented_supply', 'no_supply'],
  prescriptionReplicates: 30, reserveUnits: 20, baseDate: '2025-01-01T00:00:00Z',
  notes: [
    'All dates, daily quantities, stocks, batches, deliveries, requests and hospital identities are synthetic.',
    'Only nominal daily rate magnitudes come from published means; generated series are not original hospital data.',
    'Whole-blood is an explicitly synthetic supported-component surrogate, not a relabeling of original RBC records.',
    'India uses ALL_UNSPECIFIED and Korea unsigned ABO; no actual Rh distribution is inferred.',
    'Independent stock snapshots are sampled at each origin; these are scenario replays, not one continuous inventory history.',
    'No parameter or seed selection based on resulting model scores. Scenario proportions are design choices, not population frequencies.',
  ],
};
export const DAY = 86400000;
export const dateAt = (day, hour = 0) => new Date(Date.parse(protocol.baseDate) + day * DAY + hour * 3600000).toISOString();
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function poisson(rate, rng) {
  let product = 1, k = 0;
  const limit = Math.exp(-rate);
  do { k++; product *= rng(); } while (product > limit);
  return k - 1;
}
const nominalRates = [
  ...india.map(row => ({ id: `india-${row.phase}`, nominalRate: row.weeklyIssued / 7, bloodType: 'ALL_UNSPECIFIED', source: 'india' })),
  ...korea.map(row => ({ id: `korea-${row.abo}`, nominalRate: row.averageDailyUsage, bloodType: row.abo, source: 'korea' })),
];

export function generateDataset() {
  const series = [];
  for (const seed of protocol.seeds) {
    for (let r = 0; r < nominalRates.length; r++) {
      const anchor = nominalRates[r];
      for (let p = 0; p < protocol.patterns.length; p++) {
        const pattern = protocol.patterns[p];
        // Demand and inventory have separate random streams, so changing snapshots cannot change outcomes.
        const rng = random(seed + r * 1009 + p * 10007);
        const inventoryRng = random(seed + r * 9011 + p * 20011 + 1000000);
        const daily = Array.from({ length: protocol.days }, (_, day) => {
          let multiplier = 1;
          if (pattern === 'weekday_cycle') multiplier = [0.55, 1.15, 1.2, 1.2, 1.15, 1.1, 0.65][new Date(dateAt(day)).getUTCDay()];
          if (pattern === 'demand_spikes' && rng() < 0.10) multiplier = 3;
          if (pattern === 'level_change') multiplier = day < 90 ? 1 : day < 135 ? 1.7 : 0.65;
          if (pattern === 'intermittent') multiplier = rng() < 0.55 ? 0 : 1 / 0.45;
          const units = multiplier === 0 ? 0 : poisson(anchor.nominalRate * multiplier, rng);
          return { day, date: dateAt(day, 12), units };
        });
        const snapshots = [];
        for (let origin = protocol.warmupDays; origin + 7 <= protocol.days; origin += protocol.strideDays) {
          const coverage = [2, 5, 8, 14][Math.floor(inventoryRng() * 4)];
          const stock = Math.max(0, Math.round(anchor.nominalRate * coverage * (0.8 + inventoryRng() * 0.4)));
          const expiring = Math.floor(stock * inventoryRng() * 0.45);
          const expiryDay = origin + 1 + Math.floor(inventoryRng() * 6);
          const inventory = [
            { id: 1, available_units: expiring, expiration_date: dateAt(expiryDay), status: 'available' },
            { id: 2, available_units: stock - expiring, expiration_date: dateAt(origin + 30), status: 'available' },
          ].map(row => ({ ...row, blood_type: anchor.bloodType, component_type: 'whole_blood' }));
          const plannedDay = origin + 1 + Math.floor(inventoryRng() * 4);
          const delayDays = inventoryRng() < 0.35 ? 3 : 0;
          const receipts = inventoryRng() < 0.6 ? [{
            plannedDate: dateAt(plannedDay), actualDate: dateAt(plannedDay + delayDays), delayDays,
            units: Math.round(anchor.nominalRate * (2 + 3 * inventoryRng())), expirationDate: dateAt(origin + 30),
          }] : [];
          snapshots.push({ origin, forecastAt: dateAt(origin), inventory, receipts });
        }
        series.push({ id: `${seed}-${anchor.id}-${pattern}`, seed, ...anchor, pattern, daily, snapshots });
      }
    }
  }
  const prescriptionScenarios = [];
  const hospitals = [1, 2, 3, 4].map(id => ({ id, hospital_name: `Synthetic hospital ${id}` }));
  for (const seed of protocol.seeds) {
    const rng = random(seed + 2000000);
    for (const family of protocol.prescriptionFamilies) {
      for (let rep = 0; rep < protocol.prescriptionReplicates; rep++) {
        const anchor = nominalRates[rep % nominalRates.length];
        const units = Math.max(1, Math.round(anchor.nominalRate * 7 * (0.5 + rng())));
        const forecastAt = dateAt(60 + rep);
        const batch = (hospitalId, amount, expired = false) => ({
          hospital_id: hospitalId, blood_type: anchor.bloodType, component_type: 'whole_blood',
          available_units: amount, status: 'available', expiration_date: expired ? '2000-01-01T00:00:00Z' : dateAt(120 + rep),
        });
        const request = (id, hospitalId, quantity, priority) => ({
          id, hospital_id: hospitalId, hospital_name: hospitals.find(h => h.id === hospitalId).hospital_name,
          blood_type: anchor.bloodType, component_type: 'whole_blood', units_requested: quantity,
          status: 'pending', priority, created_at: forecastAt,
        });
        let inventory = [], requests = [request(1, 3, units, 'critical')];
        if (family === 'routine') inventory = [batch(rep % 2 ? null : 1, units + 20 + Math.floor(rng() * 10))];
        if (family === 'already_covered') inventory = [batch(1, units + 20), batch(3, units + 5)];
        if (family === 'competing_requests') {
          inventory = [batch(1, 20 + Math.round(units * 1.4))];
          requests = [request(1, 3, units, 'critical'), request(2, 4, units, 'normal')];
        }
        if (family === 'stale_expired') inventory = [batch(1, units + 20, true)];
        if (family === 'fragmented_supply') inventory = [batch(1, 20 + Math.ceil(units * 0.55)), batch(2, 20 + Math.ceil(units * 0.55))];
        prescriptionScenarios.push({ id: `${seed}-${family}-${rep}`, seed, family, anchor: anchor.id,
          forecastAt, hospitals, inventory, requests });
      }
    }
  }
  return { label: 'SYNTHETIC, PUBLISHED-MEAN-INFORMED; NOT ACTUAL HOSPITAL RECORDS',
    protocol, provenance, series, prescriptionScenarios };
}
