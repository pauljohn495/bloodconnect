import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { adminReportLoading, adminReportSection, responsiveTableContainer } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'
import { getBloodTypeChartColor } from './bloodTypeColors.js'

function AdminReports() {
  const [activeTab, setActiveTab] = useState('prescriptive') // 'prescriptive' | 'predictive'
  const [componentFilter, setComponentFilter] = useState('all') // 'all' | 'whole_blood' | 'platelets' | 'plasma'
  const [inventory, setInventory] = useState([])
  const [requests, setRequests] = useState([])
  const [donors, setDonors] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError('')
        const [inventoryData, requestsData, donorsData, hospitalsData] = await Promise.all([
          apiRequest('/api/admin/inventory'),
          apiRequest('/api/admin/requests'),
          apiRequest('/api/admin/donors'),
          apiRequest('/api/admin/hospitals'),
        ])
        setInventory(inventoryData || [])
        setRequests(requestsData || [])
        setDonors(donorsData || [])
        setHospitals(hospitalsData || [])
      } catch (err) {
        console.error('Failed to load reports data', err)
        setError(err.message || 'Failed to load reports data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24

  const diffInDays = (dateA, dateB) => {
    const a = new Date(dateA)
    const b = new Date(dateB)
    return Math.max(0, Math.round((a - b) / msPerDay))
  }

  const getHospitalName = (hospitalId) => {
    if (!hospitalId) return 'Central Inventory'
    const h = hospitals.find((x) => x.id === hospitalId)
    return h?.hospital_name || h?.hospitalName || `Hospital #${hospitalId}`
  }

  const normalizeComponentType = (value) => {
    const v = (value || '').toString().toLowerCase().trim()
    if (v === 'platelets') return 'platelets'
    if (v === 'plasma') return 'plasma'
    return 'whole_blood'
  }

  const formatComponentType = (value) => {
    const v = normalizeComponentType(value)
    if (v === 'platelets') return 'Platelets'
    if (v === 'plasma') return 'Plasma'
    return 'Whole Blood'
  }

  const RecommendationIcon = ({ kind, className }) => {
    // Simple inline SVGs so we don't rely on external icon libraries.
    if (!kind) return null

    const commonStroke = {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }

    if (kind === 'ok') {
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          aria-hidden="true"
          focusable="false"
        >
          <path d="M20 6L9 17l-5-5" {...commonStroke} />
        </svg>
      )
    }

    if (kind === 'central') {
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
          <path d="M3 12h12" {...commonStroke} />
          <path d="M13 6l6 6-6 6" {...commonStroke} />
          <path d="M3 21h9" {...commonStroke} />
        </svg>
      )
    }

    if (kind === 'transfer') {
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
          <path d="M7 7l-4 5 4 5" {...commonStroke} />
          <path d="M3 12h18" {...commonStroke} />
          <path d="M17 7l4 5-4 5" {...commonStroke} />
        </svg>
      )
    }

    // phone / default
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.51a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.81.24 1.65.42 2.51.54a2 2 0 0 1 1.72 2z"
          {...commonStroke}
        />
      </svg>
    )
  }

  // ---------- PREDICTIVE ANALYTICS ----------

  // Blood Shortage Forecast
  const usageWindowDays = 30
  const windowStart = new Date(now.getTime() - usageWindowDays * msPerDay)

  const fulfilledRequestsInWindow = requests.filter((req) => {
    if (req.status !== 'fulfilled') return false
    if (!req.request_date) return false
    const d = new Date(req.request_date)
    const ct = normalizeComponentType(req.component_type || req.componentType)
    if (componentFilter !== 'all' && ct !== componentFilter) return false
    return d >= windowStart && d <= now
  })

  const usageByBloodType = fulfilledRequestsInWindow.reduce((acc, req) => {
    const bt = req.blood_type || req.bloodType
    if (!bt) return acc
    const ct = normalizeComponentType(req.component_type || req.componentType)
    const key = `${bt}|${ct}`
    const units = req.units_approved ?? req.unitsApproved ?? req.units_requested ?? 0
    acc[key] = (acc[key] || 0) + Number(units || 0)
    return acc
  }, {})

  const stockByBloodType = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = item.blood_type || item.bloodType
      if (!bt) return acc
      const ct = normalizeComponentType(item.component_type || item.componentType)
      if (componentFilter !== 'all' && ct !== componentFilter) return acc
      const key = `${bt}|${ct}`
      const units = item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[key] = (acc[key] || 0) + Number(units || 0)
      return acc
    }, {})

  // Expired units are excluded above, so a type that only exists as expired inventory
  // would otherwise disappear from the forecast and Donor Contact Suggestions.
  inventory.forEach((item) => {
    if (item.status !== 'expired') return
    const bt = item.blood_type || item.bloodType
    if (!bt) return
    const ct = normalizeComponentType(item.component_type || item.componentType)
    if (componentFilter !== 'all' && ct !== componentFilter) return
    const key = `${bt}|${ct}`
    if (stockByBloodType[key] === undefined) stockByBloodType[key] = 0
  })

  const bloodShortageForecast = Object.entries(stockByBloodType).map(([key, currentStockRaw]) => {
    const [bloodType, componentType] = key.split('|')
    const currentStock = Number(currentStockRaw) || 0
    const usage = usageByBloodType[key] || 0

    let supplyStatusKey = 'sufficient'
    let statusLabel = 'Sufficient'
    let estimatedDaysRemaining = '—'
    let numericDaysRemaining = Infinity

    if (currentStock === 0) {
      if (usage > 0) {
        supplyStatusKey = 'critical_out'
        statusLabel = 'Critical – Out of Stock'
        estimatedDaysRemaining = '0.0'
        numericDaysRemaining = 0
      } else {
        supplyStatusKey = 'at_risk'
        statusLabel = 'At Risk'
        estimatedDaysRemaining = '—'
        numericDaysRemaining = 0
      }
    } else if (usage === 0) {
      supplyStatusKey = 'sufficient_no_usage'
      statusLabel = 'Sufficient (No recent usage)'
      estimatedDaysRemaining = '—'
      numericDaysRemaining = Infinity
    } else {
      const averageDailyUsage = usage / usageWindowDays
      const daysRemaining = currentStock / averageDailyUsage
      numericDaysRemaining = daysRemaining
      estimatedDaysRemaining = daysRemaining.toFixed(1)
      if (daysRemaining < 7) {
        supplyStatusKey = 'critical'
        statusLabel = 'Critical'
      } else if (daysRemaining < 14) {
        supplyStatusKey = 'low'
        statusLabel = 'Low'
      } else {
        supplyStatusKey = 'sufficient'
        statusLabel = 'Sufficient'
      }
    }

    return {
      bloodType,
      componentType,
      currentStock,
      estimatedDaysRemaining,
      numericDaysRemaining,
      supplyStatusKey,
      statusLabel,
    }
  })

  bloodShortageForecast.sort((a, b) => a.numericDaysRemaining - b.numericDaysRemaining)

  const getSupplyStatusClasses = (supplyStatusKey) => {
    if (supplyStatusKey === 'critical_out' || supplyStatusKey === 'critical') {
      return 'bg-red-50 text-red-700 ring-red-200'
    }
    if (supplyStatusKey === 'at_risk') {
      return 'bg-orange-50 text-orange-800 ring-orange-200'
    }
    if (supplyStatusKey === 'low') return 'bg-yellow-50 text-yellow-700 ring-yellow-200'
    if (supplyStatusKey === 'sufficient_no_usage') {
      return 'bg-sky-50 text-sky-800 ring-sky-200'
    }
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  // Blood Usage Trends (fulfilled usage in window)
  const bloodUsageTrendsData = Object.entries(usageByBloodType)
    .map(([key, unitsUsed]) => {
      const [bloodType, componentType] = key.split('|')
      return {
        label: `${bloodType} • ${formatComponentType(componentType)}`,
        bloodType,
        componentType,
        unitsUsed,
      }
    })
    .sort((a, b) => b.unitsUsed - a.unitsUsed)

  // Donor Availability Forecast
  const donorBuckets = {
    tomorrow: 0, // now
    within3: 0, // within 7 days
    within7: 0, // within 30 days
  }

  donors.forEach((donor) => {
    // If donor has never donated, treat as eligible now
    if (!donor.last_donation_date && !donor.lastDonationDate) {
      donorBuckets.tomorrow += 1
      return
    }
    const lastDate = donor.last_donation_date || donor.lastDonationDate
    const donationType =
      donor.last_donation_type || donor.lastDonationType || 'whole_blood'

    let waitDays = 56
    if (donationType === 'platelets') waitDays = 7
    else if (donationType === 'plasma') waitDays = 28

    const nextEligibleDate = new Date(lastDate)
    nextEligibleDate.setDate(nextEligibleDate.getDate() + waitDays)

    const daysUntilEligible = Math.round((nextEligibleDate - now) / msPerDay)

    if (daysUntilEligible <= 0) {
      // Eligible now
      donorBuckets.tomorrow += 1
    } else if (daysUntilEligible > 0 && daysUntilEligible <= 7) {
      // Within 7 days
      donorBuckets.within3 += 1
    } else if (daysUntilEligible > 7 && daysUntilEligible <= 30) {
      // Within 30 days
      donorBuckets.within7 += 1
    }
  })

  // Blood Expiry Risk Detection
  const expiryThresholdDays = 7
  const expiringSoonMap = inventory.reduce((acc, item) => {
    if (item.status === 'expired') return acc
    const bt = item.blood_type || item.bloodType
    if (!bt) return acc
    const ct = normalizeComponentType(item.component_type || item.componentType)
    if (componentFilter !== 'all' && ct !== componentFilter) return acc
    const expDate = item.expiration_date || item.expirationDate
    if (!expDate) return acc
    const daysLeft = diffInDays(expDate, now)
    const units = Number(
      item.available_units ?? item.availableUnits ?? item.units ?? 0,
    )
    if (daysLeft <= expiryThresholdDays && units > 0) {
      const mapKey = `${bt}|${ct}`
      if (!acc[mapKey]) acc[mapKey] = { units: 0, minDaysLeft: daysLeft, componentType: ct }
      acc[mapKey].units += units
      acc[mapKey].minDaysLeft = Math.min(acc[mapKey].minDaysLeft, daysLeft)
    }
    return acc
  }, {})

  const expiringBloodList = Object.entries(expiringSoonMap)
    .map(([key, info]) => {
      const [bloodType] = key.split('|')
      return {
        bloodType,
        componentType: info.componentType,
        units: info.units,
        minDaysLeft: info.minDaysLeft,
      }
    })
    .sort((a, b) => a.minDaysLeft - b.minDaysLeft)

  // ---------- PRESCRIPTIVE ANALYTICS ----------

  // Transfer Recommendations (generated per hospital blood request)
  // Goal: For EVERY active request, suggest the best transfer source and rank by priority.
  const reserveAtSourceUnits = 20

  const normalizeRequestPriority = (req) => {
    const raw = (req.priority || req.priority_level || req.priorityLevel || '').toString().trim()
    const p = raw.toLowerCase()
    if (p === 'critical') return 'critical'
    if (p === 'urgent') return 'urgent'
    if (p === 'normal') return 'normal'
    // Basic heuristic fallbacks if the backend doesn't provide priority explicitly
    const emergency =
      req.is_emergency === true ||
      req.isEmergency === true ||
      req.emergency === true ||
      (req.request_type || req.requestType || '').toString().toLowerCase() === 'emergency'
    if (emergency) return 'critical'
    return 'normal'
  }

  const getRequestHospitalId = (req) => {
    const id = req.hospital_id ?? req.hospitalId ?? req.hospitalID
    if (id) return Number(id)
    const name = (req.hospital_name || req.hospitalName || '').toString().trim()
    if (!name) return null
    const h = hospitals.find((x) => (x.hospital_name || x.hospitalName || '').toString().trim() === name)
    return h?.id ? Number(h.id) : null
  }

  // IMPORTANT: /admin/requests only shows "pending" requests (the visible list).
  // Transfer Recommendations should only generate for requests that would be visible there.
  const activeHospitalRequests = requests.filter((req) => {
    const status = (req.status || '').toLowerCase()
    if (status !== 'pending') return false
    const bt = req.blood_type || req.bloodType
    const hospitalName = req.hospital_name || req.hospitalName
    const units = req.units_requested ?? req.unitsRequested
    return Boolean(bt && hospitalName && Number(units || 0) > 0)
  })

  const stockByLocationAndBlood = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = item.blood_type || item.bloodType
      if (!bt) return acc
      const ct = normalizeComponentType(item.component_type || item.componentType)
      const hospitalId = item.hospital_id || item.hospitalId
      const locationKey = hospitalId ? `h:${Number(hospitalId)}` : 'central'
      const key = `${locationKey}|${bt}|${ct}`
      const units = item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[key] = (acc[key] || 0) + Number(units || 0)
      return acc
    }, {})

  const getLocationName = (locationKey) => {
    if (locationKey === 'central') return 'Central Inventory'
    if (locationKey.startsWith('h:')) return getHospitalName(Number(locationKey.slice(2)))
    return locationKey
  }

  const requestTransferRecommendations = activeHospitalRequests
    .map((req) => {
      const bloodType = req.blood_type || req.bloodType
      const componentType = normalizeComponentType(req.component_type || req.componentType)
      const unitsRequested = Number(req.units_requested ?? req.unitsRequested ?? 0)
      const hospitalId = getRequestHospitalId(req)
      const destinationHospitalName = req.hospital_name || req.hospitalName || getHospitalName(hospitalId)
      const destinationLocationKey = hospitalId ? `h:${hospitalId}` : null

      const priority = normalizeRequestPriority(req)
      const priorityScore = priority === 'critical' ? 3 : priority === 'urgent' ? 2 : 1

      const requestedAt =
        req.created_at ||
        req.createdAt ||
        req.requested_at ||
        req.requestedAt ||
        req.request_date ||
        req.requestDate ||
        null

      const destinationOnHand =
        destinationLocationKey
          ? stockByLocationAndBlood[`${destinationLocationKey}|${bloodType}|${componentType}`] || 0
          : 0
      const unitsNeeded = Math.max(0, unitsRequested - destinationOnHand)

      const candidateSources = []
      Object.entries(stockByLocationAndBlood).forEach(([key, units]) => {
        const [locationKey, bt, ct] = key.split('|')
        if (bt !== bloodType) return
        if (ct !== componentType) return
        if (destinationLocationKey && locationKey === destinationLocationKey) return
        const available = Number(units || 0)
        const sendable = locationKey === 'central' ? available : Math.max(0, available - reserveAtSourceUnits)
        if (sendable <= 0) return
        candidateSources.push({ locationKey, available, sendable })
      })

      candidateSources.sort((a, b) => b.sendable - a.sendable)
      const bestSource = candidateSources[0] || null

      const suggestedUnits = bestSource ? Math.min(bestSource.sendable, Math.max(1, unitsNeeded || unitsRequested)) : 0

      let recommendation = 'Contact donors / coordinate external supply'
      if (unitsNeeded === 0) recommendation = 'Already covered by current on-hand stock'
      else if (bestSource?.locationKey === 'central') recommendation = 'Dispatch from Central Inventory'
      else if (bestSource) recommendation = 'Transfer from another hospital'

      return {
        requestId: req.id,
        requestedAt,
        bloodType,
        componentType,
        priority,
        priorityScore,
        destinationHospitalId: hospitalId,
        destinationHospitalName,
        destinationOnHand,
        unitsRequested,
        unitsNeeded,
        sourceLocationKey: bestSource?.locationKey || null,
        suggestedUnits,
        recommendation,
      }
    })
    .sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore
      const da = a.requestedAt ? new Date(a.requestedAt) : new Date(0)
      const db = b.requestedAt ? new Date(b.requestedAt) : new Date(0)
      return da - db
    })

  // Urgent or Critical Hospital Requests
  const urgentRequests = requests
    .filter((req) => {
      const status = (req.status || '').toLowerCase()
      // Align with /admin/requests visibility: only pending requests are shown there.
      if (status !== 'pending') return false
      const priority = (req.priority || 'normal').toLowerCase()
      if (!(priority === 'urgent' || priority === 'critical')) return false
      const ct = normalizeComponentType(req.component_type || req.componentType)
      if (componentFilter !== 'all' && ct !== componentFilter) return false
      return true
    })
    .sort((a, b) => {
      const priOrder = { critical: 2, urgent: 1 }
      const pa = priOrder[(a.priority || 'urgent').toLowerCase()] || 0
      const pb = priOrder[(b.priority || 'urgent').toLowerCase()] || 0
      if (pa !== pb) return pb - pa
      const da = a.request_date ? new Date(a.request_date) : 0
      const db = b.request_date ? new Date(b.request_date) : 0
      return da - db
    })

  // Donor Contact Suggestions (aggregate by blood type, not per component row)
  // This avoids suggesting the same blood type donor when overall stock is sufficient.
  const usageByBloodTypeAggregate = fulfilledRequestsInWindow.reduce((acc, req) => {
    const bt = req.blood_type || req.bloodType
    if (!bt) return acc
    const units = req.units_approved ?? req.unitsApproved ?? req.units_requested ?? 0
    acc[bt] = (acc[bt] || 0) + Number(units || 0)
    return acc
  }, {})

  const stockByBloodTypeAggregate = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = item.blood_type || item.bloodType
      if (!bt) return acc
      const ct = normalizeComponentType(item.component_type || item.componentType)
      if (componentFilter !== 'all' && ct !== componentFilter) return acc
      const units = item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[bt] = (acc[bt] || 0) + Number(units || 0)
      return acc
    }, {})

  const shortageByBloodType = Object.keys({
    ...stockByBloodTypeAggregate,
    ...usageByBloodTypeAggregate,
  }).filter((bloodType) => {
    const currentStock = Number(stockByBloodTypeAggregate[bloodType] || 0)
    const usage = Number(usageByBloodTypeAggregate[bloodType] || 0)
    if (currentStock === 0) return true
    if (usage <= 0) return false
    const averageDailyUsage = usage / usageWindowDays
    const daysRemaining = currentStock / averageDailyUsage
    return daysRemaining < 14
  })

  const rawEligibleDonorSuggestions = shortageByBloodType.flatMap((bt) => {
    const matchingDonors = donors.filter((donor) => {
      const donorBt = (donor.blood_type || donor.bloodType || '').toString().trim()
      if (donorBt !== (bt || '').toString().trim()) return false
      if (!donor.last_donation_date && !donor.lastDonationDate) return true
      const lastDate = donor.last_donation_date || donor.lastDonationDate
      const donationType =
        donor.last_donation_type || donor.lastDonationType || 'whole_blood'
      let waitDays = 56
      if (donationType === 'platelets') waitDays = 7
      else if (donationType === 'plasma') waitDays = 28
      const nextEligibleDate = new Date(lastDate)
      nextEligibleDate.setDate(nextEligibleDate.getDate() + waitDays)
      return nextEligibleDate <= now
    })
    return matchingDonors.slice(0, 5).map((donor) => ({
      donorId: donor.id,
      bloodType: bt,
      donorName:
        donor.full_name ||
        donor.fullName ||
        donor.donor_name ||
        donor.donorName ||
        donor.username ||
        'Unnamed donor',
    }))
  })

  // Prevent duplicate donor cards when the same donor matches multiple shortage rows
  // (e.g., same blood type appears under multiple component shortages).
  const seenDonorSuggestionKeys = new Set()
  const eligibleDonorSuggestions = rawEligibleDonorSuggestions.filter((item) => {
    const key = `${item.donorId || item.donorName}|${item.bloodType}`
    if (seenDonorSuggestionKeys.has(key)) return false
    seenDonorSuggestionKeys.add(key)
    return true
  })

  // Expiring Blood Action Suggestions
  const usageByHospitalAndBlood = requests.reduce((acc, req) => {
    const bt = req.blood_type || req.bloodType
    const hospitalName = req.hospital_name || req.hospitalName
    if (!bt || !hospitalName) return acc
    const key = `${hospitalName}|${bt}`
    const units = req.units_requested ?? 0
    acc[key] = (acc[key] || 0) + Number(units || 0)
    return acc
  }, {})

  // On-hand stock by hospital for a given blood type (ignoring component type),
  // used to prioritize destinations with the lowest stock.
  const stockByHospitalAndBloodType = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = item.blood_type || item.bloodType
      if (!bt) return acc
      const hospitalId = item.hospital_id || item.hospitalId
      const hospitalKey = hospitalId ? 'h:' + Number(hospitalId) : 'central'
      const key = `${hospitalKey}|${bt}`
      const units =
        item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[key] = (acc[key] || 0) + Number(units || 0)
      return acc
    }, {})

  const resolveHospitalIdByName = (hospitalName) => {
    const wanted = (hospitalName || '').toString().trim().toLowerCase()
    if (!wanted) return null
    const h = hospitals.find((x) => {
      const name = (x.hospital_name || x.hospitalName || '')
        .toString()
        .trim()
        .toLowerCase()
      return name === wanted
    })
    return h?.id ? Number(h.id) : null
  }

  const expiringActionMap = inventory.reduce((acc, item) => {
    if (item.status === 'expired') return acc
    const bt = item.blood_type || item.bloodType
    if (!bt) return acc
    const expDate = item.expiration_date || item.expirationDate
    if (!expDate) return acc
    const daysLeft = diffInDays(expDate, now)
    if (daysLeft > expiryThresholdDays) return acc
    const units = Number(
      item.available_units ?? item.availableUnits ?? item.units ?? 0,
    )
    if (units <= 0) return acc
    if (!acc[bt]) acc[bt] = { units: 0, daysLeft }
    acc[bt].units += units
    acc[bt].daysLeft = Math.min(acc[bt].daysLeft, daysLeft)
    return acc
  }, {})

  const expiringActionSuggestions = Object.entries(expiringActionMap).map(
    ([bloodType, info]) => {
      const candidates = Object.entries(usageByHospitalAndBlood)
        .map(([key, usage]) => {
          const [hospitalName, bt] = key.split('|')
          if (bt !== bloodType) return null
          const hospitalId = resolveHospitalIdByName(hospitalName)
          const hospitalKey = hospitalId ? 'h:' + hospitalId : 'central'
          const stockKey = `${hospitalKey}|${bloodType}`
          const stock = stockByHospitalAndBloodType[stockKey] || 0
          return {
            hospitalName,
            usage: Number(usage || 0),
            stock,
          }
        })
        .filter(Boolean)

      // First, pick the "most likely" destinations by historical usage.
      const topUsageCandidates = candidates
        .filter((c) => c.usage > 0)
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5)

      // Then, prioritize lowest stock within those likely destinations.
      const suggestedHospitals = topUsageCandidates
        .sort((a, b) => a.stock - b.stock || b.usage - a.usage)
        .slice(0, 3)

      return {
        bloodType,
        units: info.units,
        daysLeft: info.daysLeft,
        suggestedHospitals,
      }
    },
  )

  expiringActionSuggestions.sort((a, b) => a.daysLeft - b.daysLeft)

  const handleFulfillRequest = async (requestId) => {
    try {
      await apiRequest(`/api/admin/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'fulfilled',
        }),
      })
      // Refresh only the requests list so analytics update
      const updatedRequests = await apiRequest('/api/admin/requests')
      setRequests(updatedRequests || [])
    } catch (err) {
      console.error('Failed to fulfill request from reports page', err)
      // Keep it simple here; main status handling is on the Requests page
    }
  }

  return (
    <AdminLayout
      pageTitle="Reports & Analytics"
      pageDescription="View predictive and prescriptive analytics for inventory, donors, and hospital requests."
    >
      {/* Tabs */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100/90 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-wrap gap-1 rounded-lg bg-slate-100/80 p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('prescriptive')}
            className={`min-h-11 flex-1 rounded-md px-3 py-2.5 text-xs font-semibold transition sm:min-h-0 sm:flex-none sm:py-2 ${
              activeTab === 'prescriptive'
                ? 'bg-white text-red-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Prescriptive analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('predictive')}
            className={`min-h-11 flex-1 rounded-md px-3 py-2.5 text-xs font-semibold transition sm:min-h-0 sm:flex-none sm:py-2 ${
              activeTab === 'predictive'
                ? 'bg-white text-red-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Predictive analytics
          </button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-xs font-medium text-slate-600 sm:text-[11px]">Component:</span>
          <select
            value={componentFilter}
            onChange={(e) => setComponentFilter(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25 sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-[11px]"
          >
            <option value="all">All</option>
            <option value="whole_blood">Whole Blood</option>
            <option value="platelets">Platelets</option>
            <option value="plasma">Plasma</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className={adminReportLoading}>
          <p className="text-sm font-medium text-slate-600">Loading reports and analytics...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-6 rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Prescriptive Analytics */}
          {activeTab === 'prescriptive' && (
            <div className="mt-6 space-y-6">
              {/* Transfer Recommendations */}
              <section className={adminReportSection.sky}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Transfer Recommendations</h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Automatically generated recommendations for every active hospital blood request.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {requestTransferRecommendations.length} requests
                  </span>
                </div>
                {requestTransferRecommendations.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No active hospital requests at the moment.
                  </p>
                ) : (
                  <div className={responsiveTableContainer}>
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Priority</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Time Requested</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Hospital</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Component</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Requested</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">On-hand</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {requestTransferRecommendations.slice(0, 30).map((rec, idx) => {
                          const priorityClasses =
                            rec.priority === 'critical'
                              ? 'bg-red-50 text-red-700 ring-red-100'
                              : rec.priority === 'urgent'
                                ? 'bg-orange-50 text-orange-700 ring-orange-100'
                                : 'bg-slate-100 text-slate-700 ring-slate-200'

                          const recommendationIconKind =
                            rec.recommendation ===
                            'Already covered by current on-hand stock'
                              ? 'ok'
                              : rec.recommendation ===
                                'Dispatch from Central Inventory'
                                ? 'central'
                                : rec.recommendation ===
                                  'Transfer from another hospital'
                                  ? 'transfer'
                                  : 'phone'

                          const recommendationAccentClasses =
                            rec.priority === 'critical'
                              ? 'border-red-200 bg-red-50/40 text-red-900'
                              : rec.priority === 'urgent'
                                ? 'border-orange-200 bg-orange-50/50 text-orange-900'
                                : 'border-slate-200 bg-slate-50 text-slate-800'
                          return (
                          <tr
                            key={rec.requestId || idx}
                            className={
                              'transition-colors hover:bg-slate-50 ' +
                              (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                            }
                          >
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ${priorityClasses}`}
                              >
                                {rec.priority.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                              {rec.requestedAt
                                ? new Date(rec.requestedAt).toLocaleString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: '2-digit',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                              {rec.destinationHospitalName}
                            </td>
                            <td className="px-3 py-2">
                              <BloodTypeBadge type={rec.bloodType} />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                              {formatComponentType(rec.componentType)}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">{rec.unitsRequested}</td>
                            <td className="px-3 py-2 text-xs text-slate-700">{rec.destinationOnHand}</td>
                            <td className="px-3 py-2">
                              <div
                                className={
                                  'rounded-lg border px-3 py-2 ' +
                                  recommendationAccentClasses
                                }
                              >
                                <div className="flex items-start gap-2">
                                  <RecommendationIcon
                                    kind={recommendationIconKind}
                                    className="mt-0.5 h-4 w-4 text-current"
                                  />
                                  <span className="text-[12px] font-semibold leading-snug">
                                    {rec.recommendation}
                                  </span>
                                </div>

                                <div className="mt-1 text-[11px] text-slate-700">
                                  Needed: {rec.unitsNeeded} • Suggested: {rec.suggestedUnits || 0}
                                </div>
                              </div>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Urgent / Critical Requests */}
              <section className={adminReportSection.rose}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Urgent &amp; Critical Requests
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Prioritize hospitals with the most time-sensitive needs.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
                    {urgentRequests.length} active
                  </span>
                </div>
                <div className={responsiveTableContainer}>
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Hospital</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Component</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Units</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {urgentRequests.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={5}>
                            No urgent or critical requests.
                          </td>
                        </tr>
                      ) : (
                        urgentRequests.slice(0, 20).map((req, idx) => {
                          const priority = (req.priority || 'normal').toLowerCase()
                          const priorityClasses =
                            priority === 'critical'
                              ? 'bg-red-50 text-red-700 ring-red-100'
                              : 'bg-orange-50 text-orange-700 ring-orange-100'
                          const rowBg = priority === 'critical' ? 'bg-red-50/40' : 'bg-white'
                          return (
                            <tr
                              key={req.id}
                              className={`transition-colors hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/40' : rowBg}`}
                            >
                              <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                                {req.hospital_name}
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                                <BloodTypeBadge type={req.blood_type} />
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                                {formatComponentType(req.component_type || req.componentType)}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-700">
                                {req.units_requested}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${priorityClasses}`}
                                >
                                  {(req.priority || 'normal').toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Donor Contact Suggestions */}
              <section className={adminReportSection.emerald}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Donor Contact Suggestions
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Top donors to reach out to for critically low or zero-stock blood types.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {eligibleDonorSuggestions.length} suggested
                  </span>
                </div>
                {eligibleDonorSuggestions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No eligible donors to suggest at the moment.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {eligibleDonorSuggestions.slice(0, 15).map((d, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                      >
                        <span className="font-semibold text-slate-900 truncate">
                          {d.donorName}
                        </span>
                        <span className="ml-3">
                          <BloodTypeBadge type={d.bloodType} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Expiring Blood Action Suggestions */}
              <section className={adminReportSection.amber}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Expiring Blood Action Suggestions
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-900">
                      Redirect near-expiry units to the hospitals most likely to use them.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                    {expiringActionSuggestions.length} at risk
                  </span>
                </div>
                {expiringActionSuggestions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No units are within the expiry risk threshold.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {expiringActionSuggestions.slice(0, 15).map((item, idx) => {
                      const suggested = item.suggestedHospitals || []
                      const top = suggested[0]
                      const others = suggested.slice(1)

                      return (
                        <li
                          key={idx}
                          className="flex flex-col rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100"
                        >
                          <span className="flex flex-wrap items-center gap-2 font-semibold text-amber-900">
                            <BloodTypeBadge type={item.bloodType} />
                            <span>
                              – {item.units} unit(s), {item.daysLeft} day(s) left
                            </span>
                          </span>

                          {top ? (
                            <span className="text-amber-800">
                              Highest priority:{' '}
                              <span className="font-semibold">
                                {top.hospitalName}
                              </span>{' '}
                              <span className="text-amber-900/90">
                                (lowest stock: {top.stock} unit(s))
                              </span>
                            </span>
                          ) : (
                            <span className="text-amber-800">
                              Suggested destination(s): high-demand hospital not identified yet
                            </span>
                          )}

                          {others.length > 0 && (
                            <span className="mt-1 text-amber-700">
                              Other options:{' '}
                              {others
                                .map(
                                  (h, i) =>
                                    `${i + 2}. ${h.hospitalName} (${h.stock} unit(s))`,
                                )
                                .join(', ')}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* Predictive Analytics */}
          {activeTab === 'predictive' && (
            <div className="mt-6 space-y-6">
              {/* Blood Shortage Forecast */}
              <section className={adminReportSection.violet}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Blood Shortage Forecast
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Estimate how long each blood type will last based on the last 30 days of usage.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {bloodShortageForecast.length} blood types tracked
                  </span>
                </div>
                <div className={responsiveTableContainer}>
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Component</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Stock</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Est. Days Remaining
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {bloodShortageForecast.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={5}>
                            No active inventory to forecast.
                          </td>
                        </tr>
                      ) : (
                        bloodShortageForecast.map((row, idx) => (
                          <tr
                            key={`${row.bloodType}|${row.componentType}`}
                            className={
                              'transition-colors hover:bg-slate-50 ' +
                              (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                            }
                          >
                            <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                              <BloodTypeBadge type={row.bloodType} />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                              {formatComponentType(row.componentType)}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {row.currentStock}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {row.supplyStatusKey === 'sufficient_no_usage'
                                ? 'No recent usage'
                                : row.supplyStatusKey === 'at_risk'
                                  ? '—'
                                  : `${row.estimatedDaysRemaining} days`}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span
                                className={`inline-flex max-w-56 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${getSupplyStatusClasses(
                                  row.supplyStatusKey,
                                )}`}
                              >
                                {row.statusLabel}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Blood Usage Trends */}
              <section className={adminReportSection.slate}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Blood Usage Trends
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Compare which blood types are most frequently requested over time.
                    </p>
                  </div>
                </div>
                {bloodUsageTrendsData.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Not enough fulfilled requests to show usage trends.
                  </p>
                ) : (
                  <div className="min-h-[200px] h-52 w-full min-w-0 sm:h-64 md:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bloodUsageTrendsData}
                        margin={{ top: 16, right: 20, left: 0, bottom: 24 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: '#475569' }}
                          stroke="#cbd5f5"
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#475569' }}
                          stroke="#cbd5f5"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value) => [`${value} units`, 'Units used']}
                        />
                        <Bar dataKey="unitsUsed" radius={[6, 6, 0, 0]}>
                          {bloodUsageTrendsData.map((entry, index) => (
                            <Cell key={`usage-${entry.label}-${index}`} fill={getBloodTypeChartColor(entry.bloodType)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* Donor Availability Forecast */}
              <section className={adminReportSection.indigo}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Donor Availability Forecast
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Plan upcoming drives by seeing how soon existing donors can donate again.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3 text-xs text-slate-700">
                  <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="text-[11px] font-medium text-emerald-700">Eligible Now</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-900">
                      {donorBuckets.tomorrow}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800">
                      Can be contacted immediately for donation.
                    </p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-100">
                    <p className="text-[11px] font-medium text-sky-700">
                      Eligible within 7 days
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-sky-900">
                      {donorBuckets.within3}
                    </p>
                    <p className="mt-1 text-[11px] text-sky-800">
                      Short-term planning window for outreach.
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
                    <p className="text-[11px] font-medium text-indigo-700">
                      Eligible within 30 days
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-indigo-900">
                      {donorBuckets.within7}
                    </p>
                    <p className="mt-1 text-[11px] text-indigo-800">
                      Medium-term donor pipeline for future needs.
                    </p>
                  </div>
                </div>
              </section>

              {/* Blood Expiry Risk Detection */}
              <section className={adminReportSection.orange}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Blood Expiry Risk Detection
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Identify blood types at highest risk of wastage in the next 7 days.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                    {expiringBloodList.length} blood types at risk
                  </span>
                </div>
                <div className={responsiveTableContainer}>
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Component</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Units Expiring Soon
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                        Days Left
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {expiringBloodList.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={4}>
                            No units within the expiry threshold.
                          </td>
                        </tr>
                      ) : (
                        expiringBloodList.map((row, idx) => (
                          <tr
                            key={`${row.bloodType}|${row.componentType}`}
                            className={
                              'transition-colors hover:bg-slate-50 ' +
                              (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                            }
                          >
                            <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                              <BloodTypeBadge type={row.bloodType} />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                              {formatComponentType(row.componentType)}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {row.units}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {row.minDaysLeft}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}

export default AdminReports

