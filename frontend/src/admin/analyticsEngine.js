const MS_PER_DAY = 1000 * 60 * 60 * 24
export const SHORTAGE_POLICY = Object.freeze({
  forecastHorizonDays: 7,
  criticalCoverageRatio: 0.2,
  persistentUnderfillMinimumEvents: 2,
  persistentUnderfillWarningRatio: 0.55,
  persistentUnderfillCriticalRatio: 0.65,
})

export const normalizeComponentType = (value) => {
  const normalized = (value || '').toString().toLowerCase().trim()
  if (!normalized || normalized === 'whole_blood' || normalized === 'whole blood') return 'whole_blood'
  if (normalized === 'platelets' || normalized === 'platelet') return 'platelets'
  if (normalized === 'plasma') return 'plasma'
  return ''
}

export const normalizeBloodType = (value) => (value || '').toString().trim().toUpperCase()

const calendarDiffInDays = (dateA, dateB) => {
  const a = new Date(dateA)
  const b = new Date(dateB)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((aDay - bDay) / MS_PER_DAY)
}

const completedUsageStatuses = new Set(['delivered', 'received', 'fulfilled'])
const historicalDemandStatuses = new Set([...completedUsageStatuses, 'partially_fulfilled'])

const usageEventDate = (request, status) => {
  if (status === 'received') {
    return request.received_at || request.receivedAt || request.delivered_at || request.deliveredAt ||
      request.fulfilled_at || request.fulfilledAt || request.request_date || request.requestDate ||
      request.created_at || request.createdAt
  }
  if (status === 'delivered') {
    return request.delivered_at || request.deliveredAt || request.fulfilled_at || request.fulfilledAt ||
      request.request_date || request.requestDate || request.created_at || request.createdAt
  }
  return request.fulfilled_at || request.fulfilledAt || request.delivered_at || request.deliveredAt ||
    request.request_date || request.requestDate || request.created_at || request.createdAt
}

const validPositiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

const validNonNegativeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const fulfilledUnitsForRequest = (request, status) => {
  const actual = request.actual_fulfilled_units ?? request.actualFulfilledUnits ??
    request.units_fulfilled ?? request.unitsFulfilled
  if (actual !== undefined && actual !== null) return validNonNegativeNumber(actual)
  if (status === 'partially_fulfilled') return 0
  return validPositiveNumber(request.units_approved ?? request.unitsApproved ?? request.units_requested)
}

export function calculateShortageForecast({
  inventory,
  requests,
  now = new Date(),
  componentFilter = 'all',
  usageWindowDays = 30,
}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime()) || !Number.isFinite(usageWindowDays) || usageWindowDays <= 0) {
    return { rows: [], fulfilledRequests: [], usageByKey: {}, stockByKey: {}, expiringSoonByKey: {} }
  }
  const safeInventory = Array.isArray(inventory) ? inventory : []
  const safeRequests = Array.isArray(requests) ? requests : []
  const windowStart = new Date(now.getTime() - usageWindowDays * MS_PER_DAY)
  const historicalRequests = safeRequests.filter((request) => {
    const status = (request.status || '').toString().toLowerCase()
    if (!historicalDemandStatuses.has(status)) return false
    const rawDate = usageEventDate(request, status)
    if (!rawDate) return false
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) return false
    const componentType = normalizeComponentType(request.component_type || request.componentType)
    if (!componentType) return false
    const requested = validPositiveNumber(request.units_requested ?? request.unitsRequested ?? request.units_approved)
    if (requested === 0) return false
    return (componentFilter === 'all' || componentType === componentFilter) && date >= windowStart && date <= now
  })

  const fulfilledRequests = historicalRequests.filter((request) => {
    const status = (request.status || '').toString().toLowerCase()
    return fulfilledUnitsForRequest(request, status) > 0
  })

  const usageByKey = fulfilledRequests.reduce((result, request) => {
    const bloodType = normalizeBloodType(request.blood_type || request.bloodType)
    if (!bloodType) return result
    const componentType = normalizeComponentType(request.component_type || request.componentType)
    const status = (request.status || '').toString().toLowerCase()
    const units = fulfilledUnitsForRequest(request, status)
    const key = `${bloodType}|${componentType}`
    result[key] = (result[key] || 0) + units
    return result
  }, {})

  const demandByKey = {}
  const unmetByKey = {}
  const underfilledEventsByKey = {}
  historicalRequests.forEach((request) => {
    const bloodType = normalizeBloodType(request.blood_type || request.bloodType)
    const componentType = normalizeComponentType(request.component_type || request.componentType)
    if (!bloodType || !componentType) return
    const key = `${bloodType}|${componentType}`
    const status = (request.status || '').toString().toLowerCase()
    const requested = validPositiveNumber(request.units_requested ?? request.unitsRequested ?? request.units_approved)
    const fulfilled = Math.min(requested, fulfilledUnitsForRequest(request, status))
    demandByKey[key] = (demandByKey[key] || 0) + requested
    unmetByKey[key] = (unmetByKey[key] || 0) + Math.max(0, requested - fulfilled)
    if (fulfilled < requested) underfilledEventsByKey[key] = (underfilledEventsByKey[key] || 0) + 1
  })

  const stockByKey = {}
  const expiringSoonByKey = {}
  const expiryBatchesByKey = {}
  safeInventory.forEach((item) => {
    const bloodType = normalizeBloodType(item.blood_type || item.bloodType)
    if (!bloodType) return
    const componentType = normalizeComponentType(item.component_type || item.componentType)
    if (!componentType) return
    if (componentFilter !== 'all' && componentType !== componentFilter) return
    const key = `${bloodType}|${componentType}`
    const expirationDate = item.expiration_date || item.expirationDate
    const daysUntilExpiry = expirationDate ? calendarDiffInDays(expirationDate, now) : null
    if ((item.status || '').toString().toLowerCase() === 'expired' || daysUntilExpiry !== null && daysUntilExpiry < 0) {
      if (stockByKey[key] === undefined) stockByKey[key] = 0
      return
    }
    const units = validPositiveNumber(item.available_units ?? item.availableUnits ?? item.units)
    stockByKey[key] = (stockByKey[key] || 0) + units
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
      expiringSoonByKey[key] = (expiringSoonByKey[key] || 0) + units
      if (!expiryBatchesByKey[key]) expiryBatchesByKey[key] = []
      expiryBatchesByKey[key].push({ units, daysUntilExpiry: Math.max(0, daysUntilExpiry) })
    }
  })

  const keys = new Set([...Object.keys(stockByKey), ...Object.keys(usageByKey), ...Object.keys(demandByKey)])
  const rows = [...keys].map((key) => {
    const rawStock = stockByKey[key] || 0
    const [bloodType, componentType] = key.split('|')
    const currentStock = Number(rawStock) || 0
    const expiringSoonUnits = Number(expiringSoonByKey[key] || 0)
    const usage = Number(usageByKey[key] || 0)
    const historicalDemand = Number(demandByKey[key] || 0)
    const recentUnmetUnits = Number(unmetByKey[key] || 0)
    const recentUnderfilledEvents = Number(underfilledEventsByKey[key] || 0)
    // Requested demand avoids hiding need when fulfillment is constrained by an existing shortage.
    const averageDailyDemand = historicalDemand / usageWindowDays
    const expectedDemandNext7Days = averageDailyDemand * SHORTAGE_POLICY.forecastHorizonDays
    const laterExpiryStock = Math.max(0, currentStock - expiringSoonUnits)
    const expiryGroups = Object.entries((expiryBatchesByKey[key] || []).reduce((groups, batch) => {
      groups[batch.daysUntilExpiry] = (groups[batch.daysUntilExpiry] || 0) + batch.units
      return groups
    }, {})).map(([days, units]) => ({ days: Number(days), units })).sort((a, b) => a.days - b.days)
    let usableExpiringStock = 0
    expiryGroups.forEach((group) => {
      const consumptionCapacity = averageDailyDemand * Math.min(SHORTAGE_POLICY.forecastHorizonDays, group.days)
      usableExpiringStock = Math.min(usableExpiringStock + group.units, consumptionCapacity)
    })
    const usableStock = Math.min(currentStock, laterExpiryStock + usableExpiringStock)
    const coverageRatio = expectedDemandNext7Days > 0 ? usableStock / expectedDemandNext7Days : Infinity
    const recentUnmetRatio = historicalDemand > 0 ? recentUnmetUnits / historicalDemand : 0
    const underfillWarning =
      recentUnderfilledEvents >= SHORTAGE_POLICY.persistentUnderfillMinimumEvents &&
      recentUnmetRatio >= SHORTAGE_POLICY.persistentUnderfillWarningRatio
    const persistentUnderfill = underfillWarning &&
      recentUnmetRatio >= SHORTAGE_POLICY.persistentUnderfillCriticalRatio
    let supplyStatusKey = 'sufficient'
    let statusLabel = 'Sufficient'
    let estimatedDaysRemaining = '—'
    let numericDaysRemaining = Infinity
    let shortageAlert = false

    if (historicalDemand === 0) {
      if (currentStock > 0) {
        supplyStatusKey = 'sufficient_no_usage'
        statusLabel = 'Sufficient (No recent usage)'
      } else {
        supplyStatusKey = 'at_risk'
        statusLabel = 'Uncertain – No Stock or Recent Usage'
        numericDaysRemaining = 0
      }
    } else if (usableStock === 0) {
      if (currentStock > 0 && expiringSoonUnits >= currentStock) {
        supplyStatusKey = 'near_expiry_only'
        statusLabel = 'Critical – Stock Expires Before Expected Use'
        estimatedDaysRemaining = '0'
        numericDaysRemaining = 0
        shortageAlert = true
      } else {
        supplyStatusKey = 'critical_out'
        statusLabel = 'Critical – Out of Stock'
        estimatedDaysRemaining = '0'
        numericDaysRemaining = 0
        shortageAlert = true
      }
    } else {
      numericDaysRemaining = usableStock / averageDailyDemand
      estimatedDaysRemaining = String(Math.round(numericDaysRemaining))
      if (coverageRatio <= SHORTAGE_POLICY.criticalCoverageRatio || persistentUnderfill) {
        supplyStatusKey = 'critical'
        statusLabel = 'Critical'
        shortageAlert = true
      } else if (coverageRatio < 1 || underfillWarning) {
        supplyStatusKey = 'low'
        statusLabel = 'Low – Monitor'
      }
    }

    return { bloodType, componentType, currentStock, expiringSoonUnits, usableExpiringStock,
      usableStock, usage, historicalDemand, recentUnmetUnits, recentUnderfilledEvents,
      recentUnmetRatio, underfillWarning, persistentUnderfill, expectedDemandNext7Days, coverageRatio,
      estimatedDaysRemaining, numericDaysRemaining, supplyStatusKey, statusLabel, shortageAlert }
  })

  rows.sort((a, b) => a.numericDaysRemaining - b.numericDaysRemaining)
  return { rows, fulfilledRequests, historicalRequests, usageByKey, demandByKey, unmetByKey,
    stockByKey, expiringSoonByKey }
}

export function calculateUsageTrends({
  requests,
  now = new Date(),
  periodDays = 30,
  componentFilter = 'all',
}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime()) || !Number.isFinite(periodDays) || periodDays <= 0) return []
  const safeRequests = Array.isArray(requests) ? requests : []
  const currentStart = new Date(now.getTime() - periodDays * MS_PER_DAY)
  const previousStart = new Date(now.getTime() - periodDays * 2 * MS_PER_DAY)
  const currentByKey = {}
  const previousByKey = {}

  safeRequests.forEach((request) => {
    const status = (request.status || '').toString().toLowerCase()
    if (!historicalDemandStatuses.has(status)) return
    const bloodType = normalizeBloodType(request.blood_type || request.bloodType)
    if (!bloodType) return
    const componentType = normalizeComponentType(request.component_type || request.componentType)
    if (!componentType) return
    if (componentFilter !== 'all' && componentType !== componentFilter) return
    const rawDate = usageEventDate(request, status)
    const date = new Date(rawDate)
    if (!rawDate || Number.isNaN(date.getTime()) || date > now) return
    const units = fulfilledUnitsForRequest(request, status)
    if (!Number.isFinite(units) || units <= 0) return
    const key = `${bloodType}|${componentType}`
    if (date >= currentStart) currentByKey[key] = (currentByKey[key] || 0) + units
    else if (date >= previousStart) previousByKey[key] = (previousByKey[key] || 0) + units
  })

  const rows = Array.from(new Set([...Object.keys(currentByKey), ...Object.keys(previousByKey)])).map((key) => {
    const [bloodType, componentType] = key.split('|')
    const currentUnits = Number(currentByKey[key] || 0)
    const previousUnits = Number(previousByKey[key] || 0)
    const averageDailyUsage = currentUnits / periodDays
    const expectedDemandNext7Days = averageDailyUsage * 7
    const percentChange = previousUnits > 0 ? ((currentUnits - previousUnits) / previousUnits) * 100 : currentUnits > 0 ? 100 : 0
    const trendKey = percentChange > 10 ? 'increasing' : percentChange < -10 ? 'decreasing' : 'stable'
    const demandRiskKey = trendKey === 'increasing' && expectedDemandNext7Days >= 12 ? 'high' : trendKey === 'increasing' || expectedDemandNext7Days >= 7 ? 'moderate' : 'low'
    const unusualKey = previousUnits > 0 ? currentUnits >= previousUnits * 1.6 ? 'spike' : currentUnits <= previousUnits * 0.5 ? 'drop' : 'normal' : currentUnits > 0 ? 'spike' : 'normal'
    return { key, bloodType, componentType, currentUnits, previousUnits, averageDailyUsage, averageWeeklyUsage: expectedDemandNext7Days, expectedDemandNext7Days, percentChange, trendKey, trendArrow: trendKey === 'increasing' ? '📈' : trendKey === 'decreasing' ? '📉' : '➖', demandRiskKey, unusualKey }
  })

  rows.sort((a, b) => b.currentUnits - a.currentUnits)
  return rows
}

export function calculateTransferRecommendations({
  inventory,
  requests,
  hospitals = [],
  reserveAtSourceUnits = 20,
  now = new Date(),
}) {
  const safeInventory = Array.isArray(inventory) ? inventory : []
  const safeRequests = Array.isArray(requests) ? requests : []
  const safeHospitals = Array.isArray(hospitals) ? hospitals : []
  const safeReserve = Number.isFinite(Number(reserveAtSourceUnits)) && Number(reserveAtSourceUnits) >= 0
    ? Number(reserveAtSourceUnits) : 0
  const hospitalName = (id) => {
    const hospital = safeHospitals.find((item) => Number(item.id) === Number(id))
    return hospital?.hospital_name || hospital?.hospitalName || `Hospital #${id}`
  }
  const hospitalId = (request) => {
    const id = request.hospital_id ?? request.hospitalId ?? request.hospitalID
    if (id) return Number(id)
    const name = (request.hospital_name || request.hospitalName || '').toString().trim()
    const hospital = safeHospitals.find((item) => (item.hospital_name || item.hospitalName || '').toString().trim() === name)
    return hospital?.id ? Number(hospital.id) : null
  }
  const priority = (request) => {
    const value = (request.priority || request.priority_level || request.priorityLevel || '').toString().trim().toLowerCase()
    if (['critical', 'urgent', 'normal'].includes(value)) return value
    const emergency = request.is_emergency === true || request.isEmergency === true || request.emergency === true || (request.request_type || request.requestType || '').toString().toLowerCase() === 'emergency'
    return emergency ? 'critical' : 'normal'
  }

  const stock = safeInventory.reduce((result, item) => {
    if ((item.status || '').toString().toLowerCase() === 'expired') return result
    const expirationDate = item.expiration_date || item.expirationDate
    if (expirationDate) {
      const daysUntilExpiry = calendarDiffInDays(expirationDate, now)
      if (daysUntilExpiry === null || daysUntilExpiry < 0) return result
    }
    const bloodType = normalizeBloodType(item.blood_type || item.bloodType)
    if (!bloodType) return result
    const componentType = normalizeComponentType(item.component_type || item.componentType)
    if (!componentType) return result
    const locationId = item.hospital_id || item.hospitalId
    const locationKey = locationId ? `h:${Number(locationId)}` : 'central'
    const key = `${locationKey}|${bloodType}|${componentType}`
    result[key] = (result[key] || 0) + validPositiveNumber(item.available_units ?? item.availableUnits ?? item.units)
    return result
  }, {})

  const remainingStock = { ...stock }
  const activeRequests = safeRequests.filter((request) => {
    const status = (request.status || '').toString().toLowerCase()
    const requestHospitalId = hospitalId(request)
    return status === 'pending' && Boolean(request.blood_type || request.bloodType) &&
      Boolean(requestHospitalId || request.hospital_name || request.hospitalName) &&
      validPositiveNumber(request.units_requested ?? request.unitsRequested) > 0 &&
      Boolean(normalizeComponentType(request.component_type || request.componentType))
  }).sort((a, b) => {
    const score = (request) => priority(request) === 'critical' ? 3 : priority(request) === 'urgent' ? 2 : 1
    return score(b) - score(a) || new Date(usageEventDate(a, 'pending') || 0) - new Date(usageEventDate(b, 'pending') || 0)
  })

  return activeRequests.map((request) => {
    const bloodType = normalizeBloodType(request.blood_type || request.bloodType)
    const componentType = normalizeComponentType(request.component_type || request.componentType)
    const unitsRequested = validPositiveNumber(request.units_requested ?? request.unitsRequested)
    const destinationHospitalId = hospitalId(request)
    const destinationHospitalName = request.hospital_name || request.hospitalName || hospitalName(destinationHospitalId)
    const destinationLocationKey = destinationHospitalId ? `h:${destinationHospitalId}` : null
    const requestPriority = priority(request)
    const destinationStockKey = destinationLocationKey ? `${destinationLocationKey}|${bloodType}|${componentType}` : null
    const destinationOnHand = destinationStockKey ? Number(stock[destinationStockKey] || 0) : 0
    const destinationAvailable = destinationStockKey ? Number(remainingStock[destinationStockKey] || 0) : 0
    const destinationUnitsApplied = Math.min(unitsRequested, destinationAvailable)
    if (destinationStockKey) remainingStock[destinationStockKey] = destinationAvailable - destinationUnitsApplied
    const unitsNeeded = Math.max(0, unitsRequested - destinationUnitsApplied)
    const candidates = Object.entries(remainingStock).flatMap(([key, units]) => {
      const [locationKey, candidateBloodType, candidateComponentType] = key.split('|')
      if (candidateBloodType !== bloodType || candidateComponentType !== componentType || locationKey === destinationLocationKey) return []
      const available = Number(units || 0)
      const sendable = locationKey === 'central' ? available : Math.max(0, available - safeReserve)
      return sendable > 0 ? [{ locationKey, available, sendable }] : []
    }).sort((a, b) => b.sendable - a.sendable)
    const bestSource = unitsNeeded > 0 ? candidates[0] || null : null
    const suggestedUnits = bestSource ? Math.min(bestSource.sendable, unitsNeeded) : 0
    if (bestSource && suggestedUnits > 0) {
      const sourceKey = `${bestSource.locationKey}|${bloodType}|${componentType}`
      remainingStock[sourceKey] = Math.max(0, Number(remainingStock[sourceKey] || 0) - suggestedUnits)
    }
    const recommendation = unitsNeeded === 0 ? 'Already covered by current on-hand stock' : bestSource?.locationKey === 'central' ? 'Dispatch from Central Inventory' : bestSource ? 'Transfer from another hospital' : 'Contact donors / coordinate external supply'
    return {
      requestId: request.id,
      requestedAt: request.created_at || request.createdAt || request.requested_at || request.requestedAt || request.request_date || request.requestDate || null,
      bloodType,
      componentType,
      priority: requestPriority,
      priorityScore: requestPriority === 'critical' ? 3 : requestPriority === 'urgent' ? 2 : 1,
      destinationHospitalId,
      destinationHospitalName,
      destinationOnHand,
      destinationUnitsApplied,
      unitsRequested,
      unitsNeeded,
      sourceLocationKey: bestSource?.locationKey || null,
      suggestedUnits,
      recommendation,
    }
  })
}
