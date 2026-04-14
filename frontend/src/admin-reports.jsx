import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminReportLoading, adminReportSection, responsiveTableContainer } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

function AdminReports() {
  const [activeTab, setActiveTab] = useState('prescriptive') // 'prescriptive' | 'predictive'
  const [componentFilter, setComponentFilter] = useState('all') // 'all' | 'whole_blood' | 'platelets' | 'plasma'
  const [usageTrendPeriodDays, setUsageTrendPeriodDays] = useState(30) // 7 | 30
  const [donorAvailabilityHorizonDays, setDonorAvailabilityHorizonDays] = useState(30) // 7 | 30
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
    const wanted = Number(hospitalId)
    const h = hospitals.find((x) => Number(x.id) === wanted)
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

  const normalizeBloodType = (value) =>
    (value || '').toString().trim().toUpperCase()

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

  const usageRequestsInWindow = requests.filter((req) => {
    const status = (req.status || '').toString().toLowerCase()
    if (!(status === 'delivered' || status === 'received')) return false
    const usageDate = req.request_date || req.requestDate || req.created_at || req.createdAt
    if (!usageDate) return false
    const d = new Date(usageDate)
    if (Number.isNaN(d.getTime())) return false
    const ct = normalizeComponentType(req.component_type || req.componentType)
    if (componentFilter !== 'all' && ct !== componentFilter) return false
    return d >= windowStart && d <= now
  })
  const fulfilledRequestsInWindow = usageRequestsInWindow

  const usageByBloodType = usageRequestsInWindow.reduce((acc, req) => {
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

  // Units that will expire within 7 days (per blood type + component),
  // treated as non-usable for shortage horizon calculations.
  const expiringSoonByBloodType = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = item.blood_type || item.bloodType
      if (!bt) return acc
      const ct = normalizeComponentType(item.component_type || item.componentType)
      if (componentFilter !== 'all' && ct !== componentFilter) return acc
      const expDate = item.expiration_date || item.expirationDate
      if (!expDate) return acc
      const daysLeft = diffInDays(expDate, now)
      if (daysLeft > 7) return acc
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
    const expiringSoonUnits = Number(expiringSoonByBloodType[key] || 0)
    const usableStock = Math.max(0, currentStock - expiringSoonUnits)
    const usage = usageByBloodType[key] || 0

    let supplyStatusKey = 'sufficient'
    let statusLabel = 'Sufficient'
    let estimatedDaysRemaining = '—'
    let numericDaysRemaining = Infinity

    if (usableStock === 0) {
      if (currentStock > 0 && expiringSoonUnits >= currentStock) {
        supplyStatusKey = 'near_expiry_only'
        statusLabel = 'Critical – Near-Expiry Stock'
        estimatedDaysRemaining = '0.0'
        numericDaysRemaining = 0
      } else if (usage > 0) {
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
      const daysRemaining = usableStock / averageDailyUsage
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
    if (supplyStatusKey === 'near_expiry_only') {
      return 'bg-rose-50 text-rose-700 ring-rose-200'
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

  // Blood Usage Trends (current period vs previous period)
  const trendNowMs = now.getTime()
  const trendCurrentStart = new Date(trendNowMs - usageTrendPeriodDays * msPerDay)
  const trendPreviousStart = new Date(trendNowMs - usageTrendPeriodDays * 2 * msPerDay)

  const trendUsageCurrentByKey = {}
  const trendUsagePreviousByKey = {}

  requests.forEach((req) => {
    const status = (req.status || '').toString().toLowerCase()
    if (!(status === 'delivered' || status === 'received')) return
    const bt = normalizeBloodType(req.blood_type || req.bloodType)
    if (!bt) return
    const ct = normalizeComponentType(req.component_type || req.componentType)
    if (componentFilter !== 'all' && ct !== componentFilter) return
    const usageDate = req.request_date || req.requestDate || req.created_at || req.createdAt
    if (!usageDate) return
    const d = new Date(usageDate)
    if (Number.isNaN(d.getTime())) return
    if (d > now) return
    const units = Number(req.units_approved ?? req.unitsApproved ?? req.units_requested ?? 0)
    if (!Number.isFinite(units) || units <= 0) return
    const key = `${bt}|${ct}`

    if (d >= trendCurrentStart) trendUsageCurrentByKey[key] = (trendUsageCurrentByKey[key] || 0) + units
    else if (d >= trendPreviousStart) trendUsagePreviousByKey[key] = (trendUsagePreviousByKey[key] || 0) + units
  })

  const trendKeys = new Set([
    ...Object.keys(trendUsageCurrentByKey),
    ...Object.keys(trendUsagePreviousByKey),
  ])

  const bloodUsageTrendRows = Array.from(trendKeys)
    .map((key) => {
      const [bloodType, componentType] = key.split('|')
      const currentUnits = Number(trendUsageCurrentByKey[key] || 0)
      const previousUnits = Number(trendUsagePreviousByKey[key] || 0)
      const averageDailyUsage = currentUnits / usageTrendPeriodDays
      const averageWeeklyUsage = averageDailyUsage * 7
      const expectedDemandNext7Days = averageWeeklyUsage
      const percentChange =
        previousUnits > 0
          ? ((currentUnits - previousUnits) / previousUnits) * 100
          : currentUnits > 0
            ? 100
            : 0

      const trendKey =
        percentChange > 10 ? 'increasing' : percentChange < -10 ? 'decreasing' : 'stable'
      const trendArrow = trendKey === 'increasing' ? '📈' : trendKey === 'decreasing' ? '📉' : '➖'
      const demandRiskKey =
        trendKey === 'increasing' && expectedDemandNext7Days >= 12
          ? 'high'
          : trendKey === 'increasing' || expectedDemandNext7Days >= 7
            ? 'moderate'
            : 'low'

      const unusualKey =
        previousUnits > 0
          ? currentUnits >= previousUnits * 1.6
            ? 'spike'
            : currentUnits <= previousUnits * 0.5
              ? 'drop'
              : 'normal'
          : currentUnits > 0
            ? 'spike'
            : 'normal'

      return {
        key,
        bloodType,
        componentType,
        currentUnits,
        previousUnits,
        averageDailyUsage,
        averageWeeklyUsage,
        expectedDemandNext7Days,
        percentChange,
        trendKey,
        trendArrow,
        demandRiskKey,
        unusualKey,
      }
    })
    .sort((a, b) => b.currentUnits - a.currentUnits)

  const trendByBloodType = bloodUsageTrendRows.reduce((acc, row) => {
    if (!acc[row.bloodType]) {
      acc[row.bloodType] = {
        bloodType: row.bloodType,
        currentUnits: 0,
        previousUnits: 0,
        expectedDemandNext7Days: 0,
      }
    }
    acc[row.bloodType].currentUnits += row.currentUnits
    acc[row.bloodType].previousUnits += row.previousUnits
    acc[row.bloodType].expectedDemandNext7Days += row.expectedDemandNext7Days
    return acc
  }, {})

  const topUsedBloodTypes = Object.values(trendByBloodType)
    .sort((a, b) => b.currentUnits - a.currentUnits)
    .slice(0, 3)

  const topIncreasingTrend = bloodUsageTrendRows
    .filter((r) => r.trendKey === 'increasing')
    .sort((a, b) => b.percentChange - a.percentChange)[0]

  const topDecreasingTrend = bloodUsageTrendRows
    .filter((r) => r.trendKey === 'decreasing')
    .sort((a, b) => a.percentChange - b.percentChange)[0]

  const notableSpike = bloodUsageTrendRows.find((r) => r.unusualKey === 'spike')
  const notableDrop = bloodUsageTrendRows.find((r) => r.unusualKey === 'drop')

  const bloodUsageTrendInsight =
    bloodUsageTrendRows.length === 0
      ? 'Not enough fulfilled request data to compute usage trends yet.'
      : topIncreasingTrend
        ? `${topIncreasingTrend.bloodType} (${formatComponentType(topIncreasingTrend.componentType)}) demand increased by ${Math.round(topIncreasingTrend.percentChange)}% in the last ${usageTrendPeriodDays} days.${notableSpike ? ` Unusual spike detected in ${notableSpike.bloodType}.` : ''}`
        : topDecreasingTrend
          ? `${topDecreasingTrend.bloodType} (${formatComponentType(topDecreasingTrend.componentType)}) usage is decreasing by ${Math.abs(Math.round(topDecreasingTrend.percentChange))}% and may lead to overstock.${notableDrop ? ` Unusual drop detected in ${notableDrop.bloodType}.` : ''}`
          : 'Demand is stable across blood types with no significant shifts versus the previous period.'

  const highDemandTypes = topUsedBloodTypes
    .filter((x) => x.currentUnits > 0)
    .slice(0, 2)
    .map((x) => x.bloodType)
  const highDemandSet = new Set(highDemandTypes)
  const maxCurrentUsage = topUsedBloodTypes[0]?.currentUnits || 0
  const lowDemandTypes = Object.values(trendByBloodType)
    .map((x) => {
      const percentChange =
        x.previousUnits > 0
          ? ((x.currentUnits - x.previousUnits) / x.previousUnits) * 100
          : x.currentUnits > 0
            ? 100
            : 0
      return { ...x, percentChange }
    })
    .filter((x) => {
      if (x.currentUnits <= 0) return false
      if (highDemandSet.has(x.bloodType)) return false
      const lowVsTop = maxCurrentUsage > 0 && x.currentUnits <= maxCurrentUsage * 0.35
      const decreasingOrFlat = x.percentChange <= 5
      return lowVsTop && decreasingOrFlat
    })
    .sort((a, b) => a.currentUnits - b.currentUnits)
    .slice(0, 2)
    .map((x) => x.bloodType)

  const bloodUsageTrendBaseSuggestion =
    bloodUsageTrendRows.length === 0
      ? 'Gather more fulfilled request records to enable trend-based recommendations.'
      : highDemandTypes.length > 0
        ? `Increase donation campaigns for high-demand blood types (${highDemandTypes.join(', ')}).${lowDemandTypes.length > 0 ? ` Temporarily reduce collection for low-demand blood types (${lowDemandTypes.join(', ')}) to prevent wastage.` : ''}`
        : 'Keep current donation and distribution strategy, and continue monitoring weekly trend shifts.'

  const getTrendRiskClasses = (riskKey) => {
    if (riskKey === 'high') return 'bg-red-50 text-red-700 ring-red-200'
    if (riskKey === 'moderate') return 'bg-amber-50 text-amber-800 ring-amber-200'
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  const bloodUsageTrendSuggestion = bloodUsageTrendBaseSuggestion

  // Donor Availability Prediction (recovery intervals aligned with admin donor details API)
  const WHOLE_BLOOD_RECOVERY_DAYS = 90
  const getRecoveryDaysForLastDonation = (donor) => {
    const t = (donor.last_donation_type || donor.lastDonationType || 'whole_blood').toString().toLowerCase()
    if (t === 'platelets') return 14
    if (t === 'plasma') return 28
    return WHOLE_BLOOD_RECOVERY_DAYS
  }

  const donorAvailabilityHorizonEnd = new Date(now.getTime() + donorAvailabilityHorizonDays * msPerDay)
  const nextWeekEnd = new Date(now.getTime() + 7 * msPerDay)
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let donorAvailEligibleNow = 0
  let donorAvailBecomingInHorizon = 0
  let donorAvailBecomingNextWeek = 0
  const donorAvailMonthBuckets = {}

  donors.forEach((donor) => {
    const lastRaw = donor.last_donation_date || donor.lastDonationDate
    if (!lastRaw) {
      donorAvailEligibleNow += 1
      return
    }
    const last = new Date(lastRaw)
    if (Number.isNaN(last.getTime())) {
      donorAvailEligibleNow += 1
      return
    }
    const recovery = getRecoveryDaysForLastDonation(donor)
    const nextEligible = new Date(last)
    nextEligible.setDate(nextEligible.getDate() + recovery)

    if (nextEligible <= now) {
      donorAvailEligibleNow += 1
      return
    }

    const ym = `${nextEligible.getFullYear()}-${String(nextEligible.getMonth() + 1).padStart(2, '0')}`
    donorAvailMonthBuckets[ym] = (donorAvailMonthBuckets[ym] || 0) + 1

    if (nextEligible <= donorAvailabilityHorizonEnd) donorAvailBecomingInHorizon += 1
    if (nextEligible <= nextWeekEnd) donorAvailBecomingNextWeek += 1
  })

  const donorAvailTotal = donors.length
  const donorAvailCanDonateWithinHorizon = donorAvailEligibleNow + donorAvailBecomingInHorizon
  const donorAvailPctWithinHorizon =
    donorAvailTotal > 0 ? Math.round((donorAvailCanDonateWithinHorizon / donorAvailTotal) * 100) : 0

  const donorAvailPeakMonthEntry = Object.entries(donorAvailMonthBuckets)
    .filter(([ym]) => ym >= currentMonthKey)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  const donorAvailPeakMonthLabel = donorAvailPeakMonthEntry
    ? new Date(`${donorAvailPeakMonthEntry[0]}-01T12:00:00`).toLocaleString('en-US', { month: 'long' })
    : null

  let donorAvailabilityLevelKey = 'low'
  if (donorAvailTotal === 0) donorAvailabilityLevelKey = 'low'
  else if (donorAvailPctWithinHorizon >= 55 || donorAvailBecomingInHorizon >= Math.max(8, donorAvailTotal * 0.2)) {
    donorAvailabilityLevelKey = 'high'
  } else if (donorAvailPctWithinHorizon >= 30 || donorAvailBecomingInHorizon >= Math.max(3, donorAvailTotal * 0.08)) {
    donorAvailabilityLevelKey = 'moderate'
  }

  const donorAvailabilityLabel =
    donorAvailabilityLevelKey === 'high'
      ? 'High Availability'
      : donorAvailabilityLevelKey === 'moderate'
        ? 'Moderate Availability'
        : 'Low Availability'

  const donorAvailabilityInsight =
    donorAvailTotal === 0
      ? 'Add donors to see availability forecasts.'
      : donorAvailPeakMonthLabel && donorAvailPeakMonthEntry[1] > 0
        ? `A ${donorAvailPeakMonthEntry[1] >= donorAvailTotal * 0.12 ? 'high' : 'notable'} number of donors are expected to become eligible in ${donorAvailPeakMonthLabel} based on last donation dates and recovery intervals (whole blood ${WHOLE_BLOOD_RECOVERY_DAYS} days). About ${donorAvailPctWithinHorizon}% of registered donors can donate within the next ${donorAvailabilityHorizonDays} days (already eligible or completing recovery in that window).`
        : donorAvailBecomingInHorizon > 0
          ? `Over the next ${donorAvailabilityHorizonDays} days, ${donorAvailBecomingInHorizon} donor${donorAvailBecomingInHorizon === 1 ? '' : 's'} will become newly eligible. Combined with donors already eligible, about ${donorAvailPctWithinHorizon}% of your donor base can participate in that period.`
          : `Most active donors are either already eligible or still outside the selected ${donorAvailabilityHorizonDays}-day window—expect lower short-term turnout unless new donors join.`

  const donorAvailabilityRecommendation =
    donorAvailTotal === 0
      ? 'Register donors and record donation dates so recovery-based forecasts can run.'
      : donorAvailabilityLevelKey === 'high' && donorAvailPeakMonthLabel
        ? `Schedule blood donation drives in ${donorAvailPeakMonthLabel} to maximize participation when the largest group finishes recovery.${donorAvailBecomingNextWeek >= 3 ? ` Send reminders to donors who become eligible in the next 7 days (${donorAvailBecomingNextWeek} donors).` : ''}`
        : donorAvailBecomingNextWeek >= 3
          ? `Send reminders to donors who will become eligible next week (${donorAvailBecomingNextWeek} donors) to fill appointment slots early.`
          : donorAvailabilityLevelKey === 'low'
            ? 'Run targeted outreach and consider mobile drives to grow the eligible pool; few donors unlock in the current window.'
            : `Plan campaigns around the ${donorAvailabilityHorizonDays}-day window (${donorAvailCanDonateWithinHorizon} donors can donate) and keep nudging donors who are already eligible.`

  const getDonorAvailabilityClasses = (levelKey) => {
    if (levelKey === 'high') return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    if (levelKey === 'moderate') return 'bg-amber-50 text-amber-800 ring-amber-200'
    return 'bg-rose-50 text-rose-800 ring-rose-200'
  }

  // Blood Expiry Risk Detection
  const expiryThresholdDays = 7
  const expiringSoonMap = inventory.reduce((acc, item) => {
    if (item.status === 'expired') return acc
    const bt = normalizeBloodType(item.blood_type || item.bloodType)
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
    if (currentStock < 5) return true
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
    const bt = normalizeBloodType(req.blood_type || req.bloodType)
    const hospitalName = req.hospital_name || req.hospitalName
    if (!bt || !hospitalName) return acc
    const key = `${hospitalName}|${bt}`
    const units = req.units_requested ?? 0
    acc[key] = (acc[key] || 0) + Number(units || 0)
    return acc
  }, {})

  const normalizeHospitalName = (value) =>
    (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

  const hospitalIdByNormalizedName = hospitals.reduce((acc, h) => {
    const raw = h.hospital_name || h.hospitalName
    const normalized = normalizeHospitalName(raw)
    if (normalized && h?.id) acc[normalized] = Number(h.id)
    return acc
  }, {})

  const resolveHospitalIdByName = (hospitalName) => {
    const wanted = normalizeHospitalName(hospitalName)
    if (!wanted) return null
    if (hospitalIdByNormalizedName[wanted]) return hospitalIdByNormalizedName[wanted]

    // Fallback: tolerate abbreviations like "LVGHI" vs "L. VIGHI HOSPITAL"
    let bestId = null
    let bestScore = Infinity
    Object.entries(hospitalIdByNormalizedName).forEach(([normalized, id]) => {
      const matches = normalized.includes(wanted) || wanted.includes(normalized)
      if (!matches) return
      const score = Math.abs(normalized.length - wanted.length)
      if (score < bestScore) {
        bestScore = score
        bestId = id
      }
    })
    return bestId
  }

  const stockByHospitalIdAndBloodType = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = normalizeBloodType(item.blood_type || item.bloodType)
      if (!bt) return acc
      const hospitalId = item.hospital_id || item.hospitalId
      if (!hospitalId) return acc
      const key = `h:${Number(hospitalId)}|${bt}`
      const units = item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[key] = (acc[key] || 0) + Number(units || 0)
      return acc
    }, {})

  // On-hand stock by (normalized hospital name + blood type). This avoids issues where
  // requests use abbreviations (e.g., "LVGHI") and inventory rows may or may not include ids.
  const stockByHospitalNameAndBloodType = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = normalizeBloodType(item.blood_type || item.bloodType)
      if (!bt) return acc

      const hospitalId = item.hospital_id || item.hospitalId
      const rawHospitalName =
        item.hospital_name || item.hospitalName || getHospitalName(hospitalId)
      const hn = normalizeHospitalName(rawHospitalName)
      if (!hn || hn === normalizeHospitalName('Central Inventory')) return acc

      const key = `${hn}|${bt}`
      const units =
        item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[key] = (acc[key] || 0) + Number(units || 0)
      return acc
    }, {})

  const expiringActionMap = inventory.reduce((acc, item) => {
    if (item.status === 'expired') return acc
    const bt = normalizeBloodType(item.blood_type || item.bloodType)
    if (!bt) return acc
    const ct = normalizeComponentType(item.component_type || item.componentType)
    if (componentFilter !== 'all' && ct !== componentFilter) return acc
    const expDate = item.expiration_date || item.expirationDate
    if (!expDate) return acc
    const daysLeft = diffInDays(expDate, now)
    if (daysLeft > expiryThresholdDays) return acc
    const units = Number(
      item.available_units ?? item.availableUnits ?? item.units ?? 0,
    )
    if (units <= 0) return acc
    const mapKey = `${bt}|${ct}`
    if (!acc[mapKey]) acc[mapKey] = { units: 0, daysLeft }
    acc[mapKey].units += units
    acc[mapKey].daysLeft = Math.min(acc[mapKey].daysLeft, daysLeft)
    return acc
  }, {})

  const expiringActionSuggestions = Object.entries(expiringActionMap).map(
    ([mapKey, info]) => {
      const pipe = mapKey.indexOf('|')
      const bloodType = pipe === -1 ? mapKey : mapKey.slice(0, pipe)
      const candidates = Object.entries(usageByHospitalAndBlood)
        .map(([key, usage]) => {
          const [hospitalName, bt] = key.split('|')
          if (bt !== bloodType) return null
          const hospitalId = resolveHospitalIdByName(hospitalName)
          const stockByIdKey = hospitalId ? `h:${Number(hospitalId)}|${bloodType}` : null
          const stockById = stockByIdKey ? stockByHospitalIdAndBloodType[stockByIdKey] || 0 : 0
          const hn = normalizeHospitalName(hospitalName)
          const stockByNameKey = `${hn}|${bloodType}`
          const stockByName = stockByHospitalNameAndBloodType[stockByNameKey] || 0
          const stock = stockById || stockByName
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

      const componentType =
        pipe === -1 ? 'whole_blood' : normalizeComponentType(mapKey.slice(pipe + 1))

      return {
        bloodType,
        componentType,
        units: info.units,
        daysLeft: info.daysLeft,
        suggestedHospitals,
      }
    },
  )

  expiringActionSuggestions.sort((a, b) => a.daysLeft - b.daysLeft)

  const expiringActionByRowKey = Object.fromEntries(
    expiringActionSuggestions.map((s) => [`${s.bloodType}|${s.componentType}`, s]),
  )

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
                    <h2 className="text-sm font-semibold text-slate-900">🔁 Transfer Recommendations</h2>
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

              {/* Blood Expiry Risk Detection (includes redirect / action suggestions) */}
              <section className={adminReportSection.orange}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      ⚠️ Blood Expiry Risk Detection
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Units at risk in the next {expiryThresholdDays} days, with suggested hospitals to
                      redirect stock based on demand and lowest on-hand levels.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                    {expiringBloodList.length} at risk
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
                        <th className="min-w-44 px-2 py-1.5 text-left text-[11px] font-medium text-slate-500">
                          💡 Suggested Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {expiringBloodList.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={5}>
                            No units within the expiry threshold.
                          </td>
                        </tr>
                      ) : (
                        expiringBloodList.map((row, idx) => {
                          const action =
                            expiringActionByRowKey[`${row.bloodType}|${row.componentType}`]
                          const suggested = action?.suggestedHospitals || []
                          const top = suggested[0]
                          const others = suggested.slice(1)

                          return (
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
                              <td className="px-3 py-2 text-xs text-slate-700">{row.units}</td>
                              <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                                {row.minDaysLeft}
                              </td>
                              <td className="min-w-44 max-w-52 px-2 py-1.5 align-top">
                                {top ? (
                                  <div className="space-y-1.5 text-[10px] leading-tight">
                                    <div className="rounded-md border border-red-100 bg-red-50/60 px-2 py-1.5">
                                      <p className="font-semibold text-red-800">🔴 Highest Priority</p>
                                      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-900">
                                        {top.hospitalName}
                                      </p>
                                      <p className="mt-0.5 text-slate-600">
                                        Redirect near-expiry units here first based on demand signals.
                                      </p>
                                      {others.length > 0 && (
                                        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50/70 px-2 py-1.5">
                                          <p className="font-semibold text-amber-900">
                                            🟡 Alternative Option
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-slate-700">
                                            If unavailable, try{' '}
                                            <span className="font-bold text-slate-900">
                                              {others.map((h) => h.hospitalName).join(', ')}
                                            </span>
                                            .
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] leading-snug text-slate-500">
                                    No high-demand destination identified yet—coordinate manually if
                                    needed.
                                  </p>
                                )}
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
                      📞 Donor Contact Suggestions
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
                      📉 Blood Shortage Forecast
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
                      📊 Blood Demand & Usage Trends
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Fulfilled-request usage by blood type and component—compare to the prior period and
                      see predicted 7-day demand.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-1">
                    {[7, 30].map((d) => (
                      <button
                        key={`trend-period-${d}`}
                        type="button"
                        onClick={() => setUsageTrendPeriodDays(d)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                          usageTrendPeriodDays === d
                            ? 'bg-white text-slate-900 ring-1 ring-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Last {d}d
                      </button>
                    ))}
                  </div>
                </div>
                {bloodUsageTrendRows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Not enough fulfilled requests to show usage trends.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 text-xs text-slate-700 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <p className="text-[11px] font-medium text-slate-600">Most Used Blood Types</p>
                        {topUsedBloodTypes.length > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {topUsedBloodTypes.map((x) => (
                              <BloodTypeBadge key={`top-used-${x.bloodType}`} type={x.bloodType} />
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-base font-semibold text-slate-900">—</p>
                        )}
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <p className="text-[11px] font-medium text-slate-600">Predicted Demand (next 7 days)</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {Math.round(
                            bloodUsageTrendRows.reduce((sum, r) => sum + r.expectedDemandNext7Days, 0),
                          )}{' '}
                          units
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <p className="text-[11px] font-medium text-slate-600">Unusual Activity</p>
                        {notableSpike ? (
                          <div className="mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-900">
                            <span>Spike:</span>
                            <BloodTypeBadge type={notableSpike.bloodType} />
                          </div>
                        ) : notableDrop ? (
                          <div className="mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-900">
                            <span>Drop:</span>
                            <BloodTypeBadge type={notableDrop.bloodType} />
                          </div>
                        ) : (
                          <p className="mt-1 text-base font-semibold text-slate-900">None</p>
                        )}
                      </div>
                    </div>

                    <div className={responsiveTableContainer}>
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Component</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Used ({usageTrendPeriodDays}d)</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Avg / Day</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Trend</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Change vs Prev</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Predicted 7d</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Risk</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {bloodUsageTrendRows.slice(0, 10).map((row) => (
                            <tr key={`trend-row-${row.key}`}>
                              <td className="px-3 py-2">
                                <BloodTypeBadge type={row.bloodType} />
                              </td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                {formatComponentType(row.componentType)}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{Math.round(row.currentUnits)}</td>
                              <td className="px-3 py-2 text-slate-700">
                                {row.averageDailyUsage.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {row.trendArrow}{' '}
                                {row.trendKey === 'increasing'
                                  ? 'Increasing'
                                  : row.trendKey === 'decreasing'
                                    ? 'Decreasing'
                                    : 'Stable'}
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {row.percentChange >= 0 ? '+' : ''}
                                {Math.round(row.percentChange)}%
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {Math.round(row.expectedDemandNext7Days)}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${getTrendRiskClasses(
                                    row.demandRiskKey,
                                  )}`}
                                >
                                  {row.demandRiskKey === 'high'
                                    ? '🔴 High'
                                    : row.demandRiskKey === 'moderate'
                                      ? '🟡 Moderate'
                                      : '🟢 Low'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                        <p className="text-[11px] font-semibold text-amber-800">⚠️ Insight</p>
                        <p className="mt-1 text-xs text-amber-900">{bloodUsageTrendInsight}</p>
                      </div>
                      <div className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200">
                        <p className="text-[11px] font-semibold text-sky-800">💡 Suggestion</p>
                        <p className="mt-1 text-xs text-sky-900">{bloodUsageTrendSuggestion}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Donor Availability Insights */}
              <section className={adminReportSection.indigo}>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      📅 Donor Availability Insights
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Estimates how many donors can donate soon using last donation dates and recovery
                      intervals (whole blood {WHOLE_BLOOD_RECOVERY_DAYS} days). Peak month shows when the
                      largest group becomes eligible again.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1">
                      {[7, 30].map((d) => (
                        <button
                          key={`donor-avail-${d}`}
                          type="button"
                          onClick={() => setDonorAvailabilityHorizonDays(d)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            donorAvailabilityHorizonDays === d
                              ? 'bg-white text-slate-900 ring-1 ring-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Next {d} days
                        </button>
                      ))}
                    </div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${getDonorAvailabilityClasses(
                        donorAvailabilityLevelKey,
                      )}`}
                    >
                      {donorAvailabilityLabel}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <p className="text-[11px] font-medium text-slate-600">Eligible now</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{donorAvailEligibleNow}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Ready to donate today</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <p className="text-[11px] font-medium text-slate-600">
                      Newly eligible ({donorAvailabilityHorizonDays}d)
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {donorAvailBecomingInHorizon}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">Finish recovery in this window</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <p className="text-[11px] font-medium text-slate-600">Can donate in window</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {donorAvailCanDonateWithinHorizon}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {donorAvailTotal > 0 ? `${donorAvailPctWithinHorizon}% of registered donors` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <p className="text-[11px] font-medium text-slate-600">Peak upcoming month</p>
                    {donorAvailPeakMonthLabel && donorAvailPeakMonthEntry ? (
                      <>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{donorAvailPeakMonthLabel}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {donorAvailPeakMonthEntry[1]} donor{donorAvailPeakMonthEntry[1] === 1 ? '' : 's'}{' '}
                          become eligible
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-base font-semibold text-slate-900">—</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-indigo-50/80 px-3 py-2 text-[11px] text-indigo-900 ring-1 ring-indigo-100">
                  <span className="font-semibold">Next 7 days: </span>
                  {donorAvailBecomingNextWeek} donor{donorAvailBecomingNextWeek === 1 ? '' : 's'} become
                  eligible — use this for reminder timing.
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                    <p className="text-[11px] font-semibold text-amber-800">⚠️ Insight</p>
                    <p className="mt-1 text-xs text-amber-900">{donorAvailabilityInsight}</p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200">
                    <p className="text-[11px] font-semibold text-sky-800">💡 Recommendation</p>
                    <p className="mt-1 text-xs text-sky-900">{donorAvailabilityRecommendation}</p>
                  </div>
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

