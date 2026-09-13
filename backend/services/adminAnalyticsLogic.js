const toFiniteNonNegative = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const requestPriorityScore = (priority) => {
  const normalized = (priority || 'normal').toString().toLowerCase()
  if (normalized === 'critical') return 3
  if (normalized === 'urgent') return 2
  return 1
}

const expiryPriority = (daysUntilExpiry) => {
  if (daysUntilExpiry <= 3) return 'high'
  if (daysUntilExpiry <= 7) return 'medium'
  return 'low'
}

const allocateNearExpiryInventory = (inventoryRows, requestRows) => {
  const inventory = inventoryRows.map((row) => ({
    ...row,
    available_units: toFiniteNonNegative(row.available_units),
    days_until_expiry: Number(row.days_until_expiry),
  })).sort((a, b) => a.days_until_expiry - b.days_until_expiry || a.id - b.id)

  const requests = requestRows.map((row) => ({
    ...row,
    units_requested: toFiniteNonNegative(row.units_requested),
    priority: (row.priority || 'normal').toString().toLowerCase(),
  })).sort((a, b) =>
    requestPriorityScore(b.priority) - requestPriorityScore(a.priority) ||
    new Date(a.request_date || 0) - new Date(b.request_date || 0),
  )

  const transferRecommendations = []
  requests.forEach((request) => {
    let unitsRemaining = request.units_requested
    for (const batch of inventory) {
      if (unitsRemaining <= 0) break
      if (
        batch.available_units <= 0 ||
        batch.blood_type !== request.blood_type ||
        (batch.component_type || 'whole_blood') !== (request.component_type || 'whole_blood')
      ) continue

      const units = Math.min(batch.available_units, unitsRemaining)
      transferRecommendations.push({
        type: 'transfer',
        priority: expiryPriority(batch.days_until_expiry),
        requestPriority: request.priority,
        inventoryId: batch.id,
        bloodType: batch.blood_type,
        componentType: batch.component_type || 'whole_blood',
        units,
        daysUntilExpiry: batch.days_until_expiry,
        targetHospitalId: request.hospital_id,
        targetHospitalName: request.hospital_name,
        requestId: request.id,
        requestedAt: request.request_date || null,
        impact: `Prevent ${units} units from expiring`,
        reason: `Match expiring inventory with pending request from ${request.hospital_name}`,
      })
      batch.available_units -= units
      unitsRemaining -= units
    }
  })

  transferRecommendations.sort((a, b) =>
    requestPriorityScore(b.requestPriority) - requestPriorityScore(a.requestPriority) ||
    new Date(a.requestedAt || 0) - new Date(b.requestedAt || 0) ||
    a.daysUntilExpiry - b.daysUntilExpiry,
  )
  return { inventory, transferRecommendations }
}

module.exports = { allocateNearExpiryInventory, requestPriorityScore, toFiniteNonNegative }
