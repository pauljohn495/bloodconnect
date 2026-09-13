export const referenceDate = '2026-09-01T12:00:00.000Z'

export const hospitals = [
  { id: 901, hospital_name: 'Simulation General Hospital' },
  { id: 902, hospital_name: 'Simulation Community Hospital' },
]

const fulfilled = (id, bloodType, componentType, units, requestDate) => ({
  id,
  hospital_id: 901,
  hospital_name: 'Simulation General Hospital',
  blood_type: bloodType,
  component_type: componentType,
  units_requested: units,
  units_approved: units,
  request_date: requestDate,
  status: 'delivered',
  priority: 'normal',
})

// March through June establish a visible six-month history. July and August are
// deliberately controlled because the production trend rules compare two 30-day windows.
export const requests = [
  fulfilled(1001, 'O+', 'whole_blood', 30, '2026-03-15T12:00:00.000Z'),
  fulfilled(1002, 'O+', 'whole_blood', 32, '2026-04-15T12:00:00.000Z'),
  fulfilled(1003, 'O+', 'whole_blood', 35, '2026-05-15T12:00:00.000Z'),
  fulfilled(1004, 'O+', 'whole_blood', 38, '2026-06-15T12:00:00.000Z'),
  fulfilled(1005, 'A+', 'whole_blood', 24, '2026-03-16T12:00:00.000Z'),
  fulfilled(1006, 'A+', 'whole_blood', 26, '2026-04-16T12:00:00.000Z'),
  fulfilled(1007, 'A+', 'whole_blood', 28, '2026-05-16T12:00:00.000Z'),
  fulfilled(1008, 'A+', 'whole_blood', 30, '2026-06-16T12:00:00.000Z'),
  fulfilled(1009, 'AB+', 'whole_blood', 35, '2026-03-17T12:00:00.000Z'),
  fulfilled(1010, 'AB+', 'whole_blood', 34, '2026-04-17T12:00:00.000Z'),
  fulfilled(1011, 'AB+', 'whole_blood', 33, '2026-05-17T12:00:00.000Z'),
  fulfilled(1012, 'AB+', 'whole_blood', 32, '2026-06-17T12:00:00.000Z'),

  fulfilled(1101, 'O+', 'whole_blood', 15, '2026-07-10T12:00:00.000Z'),
  fulfilled(1102, 'O+', 'whole_blood', 15, '2026-07-24T12:00:00.000Z'),
  fulfilled(1103, 'A+', 'whole_blood', 15, '2026-07-11T12:00:00.000Z'),
  fulfilled(1104, 'A+', 'whole_blood', 15, '2026-07-25T12:00:00.000Z'),
  fulfilled(1105, 'AB+', 'whole_blood', 15, '2026-07-12T12:00:00.000Z'),
  fulfilled(1106, 'AB+', 'whole_blood', 15, '2026-07-26T12:00:00.000Z'),
  fulfilled(1107, 'O-', 'whole_blood', 5, '2026-07-20T12:00:00.000Z'),

  fulfilled(1201, 'O+', 'whole_blood', 20, '2026-08-10T12:00:00.000Z'),
  fulfilled(1202, 'O+', 'whole_blood', 20, '2026-08-20T12:00:00.000Z'),
  fulfilled(1203, 'O+', 'whole_blood', 20, '2026-08-30T12:00:00.000Z'),
  fulfilled(1204, 'A+', 'whole_blood', 15, '2026-08-11T12:00:00.000Z'),
  fulfilled(1205, 'A+', 'whole_blood', 15, '2026-08-25T12:00:00.000Z'),
  fulfilled(1206, 'AB+', 'whole_blood', 5, '2026-08-12T12:00:00.000Z'),
  fulfilled(1207, 'AB+', 'whole_blood', 5, '2026-08-26T12:00:00.000Z'),
  fulfilled(1208, 'O-', 'whole_blood', 5, '2026-08-22T12:00:00.000Z'),

  { id: 1301, hospital_id: 901, hospital_name: 'Simulation General Hospital', blood_type: 'O-', component_type: 'whole_blood', units_requested: 8, request_date: '2026-08-28T08:00:00.000Z', created_at: '2026-08-28T08:00:00.000Z', status: 'pending', priority: 'critical' },
  { id: 1302, hospital_id: 901, hospital_name: 'Simulation General Hospital', blood_type: 'A-', component_type: 'plasma', units_requested: 15, request_date: '2026-08-25T08:00:00.000Z', created_at: '2026-08-25T08:00:00.000Z', status: 'pending', priority: 'urgent' },
  { id: 1303, hospital_id: 901, hospital_name: 'Simulation General Hospital', blood_type: 'O+', component_type: 'plasma', units_requested: 20, request_date: '2026-08-26T08:00:00.000Z', created_at: '2026-08-26T08:00:00.000Z', status: 'pending', priority: 'urgent' },
  { id: 1304, hospital_id: 901, hospital_name: 'Simulation General Hospital', blood_type: 'O+', component_type: 'whole_blood', units_requested: 10, request_date: '2026-08-27T08:00:00.000Z', created_at: '2026-08-27T08:00:00.000Z', status: 'pending', priority: 'normal' },
  { id: 1305, hospital_id: 902, hospital_name: 'Simulation Community Hospital', blood_type: 'A+', component_type: 'platelets', units_requested: 5, request_date: '2026-08-29T08:00:00.000Z', created_at: '2026-08-29T08:00:00.000Z', status: 'pending', priority: 'normal' },
]

export const inventory = [
  { id: 2001, blood_type: 'O+', component_type: 'whole_blood', available_units: 12, expiration_date: '2026-10-01T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2002, blood_type: 'O+', component_type: 'whole_blood', available_units: 8, expiration_date: '2026-09-05T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2003, blood_type: 'A+', component_type: 'whole_blood', available_units: 60, expiration_date: '2026-10-15T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2004, blood_type: 'AB+', component_type: 'whole_blood', available_units: 80, expiration_date: '2026-10-15T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2005, blood_type: 'B+', component_type: 'platelets', available_units: 12, expiration_date: '2026-09-03T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2006, blood_type: 'A-', component_type: 'plasma', available_units: 20, expiration_date: '2026-09-06T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2007, blood_type: 'A-', component_type: 'plasma', available_units: 2, expiration_date: '2026-09-20T12:00:00.000Z', status: 'available', hospital_id: 901 },
  { id: 2008, blood_type: 'O-', component_type: 'whole_blood', available_units: 5, expiration_date: '2026-08-20T12:00:00.000Z', status: 'expired', hospital_id: null },
  { id: 2009, blood_type: 'AB-', component_type: 'whole_blood', available_units: 25, expiration_date: '2026-10-20T12:00:00.000Z', status: 'available', hospital_id: null },
  { id: 2010, blood_type: 'A+', component_type: 'platelets', available_units: 10, expiration_date: '2026-09-20T12:00:00.000Z', status: 'available', hospital_id: 902 },
  { id: 2011, blood_type: 'O+', component_type: 'plasma', available_units: 40, expiration_date: '2026-10-10T12:00:00.000Z', status: 'available', hospital_id: 902 },
]

export const donors = [
  { id: 3001, full_name: 'Simulated O Negative Donor 1', blood_type: 'O-', last_donation_date: '2026-06-01', last_donation_type: 'whole_blood' },
  { id: 3002, full_name: 'Simulated O Negative Donor 2', blood_type: 'O-', last_donation_date: null, last_donation_type: null },
  { id: 3003, full_name: 'Simulated O Positive Donor', blood_type: 'O+', last_donation_date: '2026-06-15', last_donation_type: 'whole_blood' },
  { id: 3004, full_name: 'Ineligible O Negative Donor', blood_type: 'O-', last_donation_date: '2026-08-15', last_donation_type: 'whole_blood' },
]

// These September outcomes are intentionally withheld from the analytics input.
// They let the harness measure forecast error instead of only checking formulas.
export const holdoutActuals = [
  { bloodType: 'O+', componentType: 'whole_blood', actualUnitsNext7Days: 14 },
  { bloodType: 'A+', componentType: 'whole_blood', actualUnitsNext7Days: 7 },
  { bloodType: 'AB+', componentType: 'whole_blood', actualUnitsNext7Days: 2 },
  { bloodType: 'O-', componentType: 'whole_blood', actualUnitsNext7Days: 1 },
]

export default { referenceDate, hospitals, requests, inventory, donors, holdoutActuals }
