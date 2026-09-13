const referenceDate = '2026-09-01T12:00:00.000Z'

const hospitals = [
  { id: 901, hospital_name: 'Simulation General Hospital' },
  { id: 902, hospital_name: 'Simulation Community Hospital' },
]

const fulfilled = (id, bloodType, units, date) => ({
  id,
  hospital_id: 901,
  hospital_name: 'Simulation General Hospital',
  blood_type: bloodType,
  component_type: 'whole_blood',
  units_requested: units,
  units_approved: units,
  request_date: `${date}T12:00:00.000Z`,
  status: 'delivered',
  priority: 'normal',
})

const history = [
  ['2026-03-15', 30, 24, 35], ['2026-04-15', 32, 26, 34],
  ['2026-05-15', 35, 28, 33], ['2026-06-15', 38, 30, 32],
]
const requests = history.flatMap(([date, oPositive, aPositive, abPositive], index) => [
  fulfilled(1001 + index * 3, 'O+', oPositive, date),
  fulfilled(1002 + index * 3, 'A+', aPositive, date),
  fulfilled(1003 + index * 3, 'AB+', abPositive, date),
])

requests.push(
  fulfilled(1101, 'O+', 15, '2026-07-10'), fulfilled(1102, 'O+', 15, '2026-07-24'),
  fulfilled(1103, 'A+', 15, '2026-07-11'), fulfilled(1104, 'A+', 15, '2026-07-25'),
  fulfilled(1105, 'AB+', 15, '2026-07-12'), fulfilled(1106, 'AB+', 15, '2026-07-26'),
  fulfilled(1107, 'O-', 5, '2026-07-20'),
  fulfilled(1201, 'O+', 20, '2026-08-10'), fulfilled(1202, 'O+', 20, '2026-08-20'),
  fulfilled(1203, 'O+', 20, '2026-08-30'), fulfilled(1204, 'A+', 15, '2026-08-11'),
  fulfilled(1205, 'A+', 15, '2026-08-25'), fulfilled(1206, 'AB+', 5, '2026-08-12'),
  fulfilled(1207, 'AB+', 5, '2026-08-26'), fulfilled(1208, 'O-', 5, '2026-08-22'),
)

const pending = (id, hospitalId, bloodType, componentType, units, date, priority) => ({
  id,
  hospital_id: hospitalId,
  hospital_name: hospitals.find((hospital) => hospital.id === hospitalId).hospital_name,
  blood_type: bloodType,
  component_type: componentType,
  units_requested: units,
  request_date: `${date}T08:00:00.000Z`,
  created_at: `${date}T08:00:00.000Z`,
  status: 'pending',
  priority,
})

requests.push(
  pending(1301, 901, 'O-', 'whole_blood', 8, '2026-08-28', 'critical'),
  pending(1302, 901, 'A-', 'plasma', 15, '2026-08-25', 'urgent'),
  pending(1303, 901, 'O+', 'plasma', 20, '2026-08-26', 'urgent'),
  pending(1304, 901, 'O+', 'whole_blood', 10, '2026-08-27', 'normal'),
  pending(1305, 902, 'A+', 'platelets', 5, '2026-08-29', 'normal'),
)

const inventory = [
  [2001, 'O+', 'whole_blood', 12, '2026-10-01', null, 'available'],
  [2002, 'O+', 'whole_blood', 8, '2026-09-05', null, 'available'],
  [2003, 'A+', 'whole_blood', 60, '2026-10-15', null, 'available'],
  [2004, 'AB+', 'whole_blood', 80, '2026-10-15', null, 'available'],
  [2005, 'B+', 'platelets', 12, '2026-09-03', null, 'available'],
  [2006, 'A-', 'plasma', 20, '2026-09-06', null, 'available'],
  [2007, 'A-', 'plasma', 2, '2026-09-20', 901, 'available'],
  [2008, 'O-', 'whole_blood', 5, '2026-08-20', null, 'expired'],
  [2009, 'AB-', 'whole_blood', 25, '2026-10-20', null, 'available'],
  [2010, 'A+', 'platelets', 10, '2026-09-20', 902, 'available'],
  [2011, 'O+', 'plasma', 40, '2026-10-10', 902, 'available'],
].map(([id, blood_type, component_type, available_units, date, hospital_id, status]) => ({
  id, blood_type, component_type, available_units, units: available_units,
  expiration_date: `${date}T12:00:00.000Z`, hospital_id, status,
}))

const donors = [
  { id: 3001, full_name: 'Simulated O Negative Donor 1', blood_type: 'O-', last_donation_date: '2026-06-01', last_donation_type: 'whole_blood' },
  { id: 3002, full_name: 'Simulated O Negative Donor 2', blood_type: 'O-', last_donation_date: null, last_donation_type: null },
  { id: 3003, full_name: 'Simulated O Positive Donor', blood_type: 'O+', last_donation_date: '2026-06-15', last_donation_type: 'whole_blood' },
  { id: 3004, full_name: 'Ineligible O Negative Donor', blood_type: 'O-', last_donation_date: '2026-08-15', last_donation_type: 'whole_blood' },
]

export default { referenceDate, hospitals, requests, inventory, donors }
