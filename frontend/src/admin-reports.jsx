import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function AdminReports() {
  const [activeTab, setActiveTab] = useState('prescriptive') // 'prescriptive' | 'predictive'
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

  // ---------- PREDICTIVE ANALYTICS ----------

  // Blood Shortage Forecast
  const usageWindowDays = 30
  const windowStart = new Date(now.getTime() - usageWindowDays * msPerDay)

  const fulfilledRequestsInWindow = requests.filter((req) => {
    if (req.status !== 'fulfilled') return false
    if (!req.request_date) return false
    const d = new Date(req.request_date)
    return d >= windowStart && d <= now
  })

  const usageByBloodType = fulfilledRequestsInWindow.reduce((acc, req) => {
    const bt = req.blood_type || req.bloodType
    if (!bt) return acc
    const units = req.units_approved ?? req.unitsApproved ?? req.units_requested ?? 0
    acc[bt] = (acc[bt] || 0) + Number(units || 0)
    return acc
  }, {})

  const stockByBloodType = inventory
    .filter((item) => item.status !== 'expired')
    .reduce((acc, item) => {
      const bt = item.blood_type || item.bloodType
      if (!bt) return acc
      const units = item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[bt] = (acc[bt] || 0) + Number(units || 0)
      return acc
    }, {})

  const bloodShortageForecast = Object.entries(stockByBloodType).map(([bloodType, currentStock]) => {
    const usedInWindow = usageByBloodType[bloodType] || 0
    const averageDailyUsage =
      usedInWindow > 0 ? usedInWindow / Math.max(1, usageWindowDays) : 0
    const daysRemaining =
      averageDailyUsage > 0 ? currentStock / averageDailyUsage : Infinity

    let status = 'sufficient'
    if (daysRemaining < 7) status = 'critical'
    else if (daysRemaining < 14) status = 'low'

    return {
      bloodType,
      currentStock,
      estimatedDaysRemaining: daysRemaining === Infinity ? '—' : daysRemaining.toFixed(1),
      numericDaysRemaining: daysRemaining,
      status,
    }
  })

  bloodShortageForecast.sort((a, b) => a.numericDaysRemaining - b.numericDaysRemaining)

  const getSupplyStatusClasses = (status) => {
    if (status === 'critical') return 'bg-red-50 text-red-700 ring-red-200'
    if (status === 'low') return 'bg-yellow-50 text-yellow-700 ring-yellow-200'
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  const getSupplyStatusLabel = (status) => {
    if (status === 'critical') return 'Critical'
    if (status === 'low') return 'Low'
    return 'Sufficient'
  }

  // Blood Usage Trends (fulfilled usage in window)
  const bloodUsageTrendsData = Object.entries(usageByBloodType)
    .map(([bloodType, unitsUsed]) => ({ bloodType, unitsUsed }))
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
    const expDate = item.expiration_date || item.expirationDate
    if (!expDate) return acc
    const daysLeft = diffInDays(expDate, now)
    const units = Number(
      item.available_units ?? item.availableUnits ?? item.units ?? 0,
    )
    if (daysLeft <= expiryThresholdDays && units > 0) {
      if (!acc[bt]) acc[bt] = { units: 0, minDaysLeft: daysLeft }
      acc[bt].units += units
      acc[bt].minDaysLeft = Math.min(acc[bt].minDaysLeft, daysLeft)
    }
    return acc
  }, {})

  const expiringBloodList = Object.entries(expiringSoonMap)
    .map(([bloodType, info]) => ({
      bloodType,
      units: info.units,
      minDaysLeft: info.minDaysLeft,
    }))
    .sort((a, b) => a.minDaysLeft - b.minDaysLeft)

  // ---------- PRESCRIPTIVE ANALYTICS ----------

  // Transfer Recommendations between hospitals
  const criticalThreshold = 10
  const sufficientThreshold = 20

  const hospitalStockByBlood = inventory
    .filter((item) => item.hospital_id || item.hospitalId)
    .reduce((acc, item) => {
      const hospitalId = item.hospital_id || item.hospitalId
      const bt = item.blood_type || item.bloodType
      if (!hospitalId || !bt) return acc
      const key = `${hospitalId}|${bt}`
      const units = item.available_units ?? item.availableUnits ?? item.units ?? 0
      acc[key] = (acc[key] || 0) + Number(units || 0)
      return acc
    }, {})

  const groupedByBloodType = {}
  Object.entries(hospitalStockByBlood).forEach(([key, units]) => {
    const [hospitalIdStr, bt] = key.split('|')
    const hospitalId = Number(hospitalIdStr)
    if (!groupedByBloodType[bt]) groupedByBloodType[bt] = []
    let level = 'sufficient'
    if (units < criticalThreshold) level = 'critical'
    else if (units <= sufficientThreshold) level = 'low'
    groupedByBloodType[bt].push({ hospitalId, units, level })
  })

  const transferRecommendations = []
  Object.entries(groupedByBloodType).forEach(([bloodType, hospitalsForType]) => {
    const criticalHospitals = hospitalsForType.filter((h) => h.level === 'critical')
    const sufficientHospitals = hospitalsForType.filter((h) => h.level === 'sufficient')

    criticalHospitals.forEach((criticalHospital) => {
      sufficientHospitals.forEach((sourceHospital) => {
        const maxSendable = sourceHospital.units - sufficientThreshold
        if (maxSendable <= 0) return
        const needed = criticalThreshold - criticalHospital.units
        if (needed <= 0) return
        const suggestedUnits = Math.min(maxSendable, needed)
        if (suggestedUnits <= 0) return
        transferRecommendations.push({
          bloodType,
          sourceHospitalId: sourceHospital.hospitalId,
          destinationHospitalId: criticalHospital.hospitalId,
          sourceHospitalName: getHospitalName(sourceHospital.hospitalId),
          destinationHospitalName: getHospitalName(criticalHospital.hospitalId),
          suggestedUnits,
        })
      })
    })
  })

  transferRecommendations.sort((a, b) => b.suggestedUnits - a.suggestedUnits)

  // Urgent or Critical Hospital Requests
  const urgentRequests = requests
    .filter((req) => {
      const status = (req.status || '').toLowerCase()
      if (status === 'fulfilled' || status === 'completed' || status === 'cancelled') {
        return false
      }
      const priority = (req.priority || 'normal').toLowerCase()
      return priority === 'urgent' || priority === 'critical'
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

  // Donor Contact Suggestions (for critically low or zero stock)
  const shortageByBloodType = bloodShortageForecast.filter(
    (b) => b.status === 'critical' || (b.currentStock || 0) === 0,
  )

  const eligibleDonorSuggestions = shortageByBloodType.flatMap((shortage) => {
    const bt = shortage.bloodType
    const matchingDonors = donors.filter((donor) => {
      const donorBt = donor.blood_type || donor.bloodType
      if (donorBt !== bt) return false
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
      let bestHospital = null
      let bestUsage = 0
      Object.entries(usageByHospitalAndBlood).forEach(([key, usage]) => {
        const [hospitalName, bt] = key.split('|')
        if (bt !== bloodType) return
        if (usage > bestUsage) {
          bestUsage = usage
          bestHospital = hospitalName
        }
      })
      return {
        bloodType,
        units: info.units,
        daysLeft: info.daysLeft,
        suggestedHospital: bestHospital,
      }
    },
  )

  expiringActionSuggestions.sort((a, b) => a.daysLeft - b.daysLeft)

  const handleFulfillRequest = async (requestId) => {
    try {
      await apiRequest(`/api/admin/requests/${requestId}/status`, {
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
      <div className="mb-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('prescriptive')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'prescriptive'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Prescriptive Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('predictive')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'predictive'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Predictive Analytics
          </button>
        </div>
        <div />
      </div>

      {isLoading && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Loading reports and analytics...</p>
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
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Transfer Recommendations</h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Balance stocks by moving surplus units to hospitals with critical shortages.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {transferRecommendations.length} suggestions
                  </span>
                </div>
                {transferRecommendations.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No transfer recommendations at the moment.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">From</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">To</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Units</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {transferRecommendations.slice(0, 20).map((rec, idx) => (
                          <tr
                            key={idx}
                            className={
                              'transition-colors hover:bg-slate-50 ' +
                              (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                            }
                          >
                            <td className="px-3 py-2">
                              <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
                                {rec.bloodType}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {rec.sourceHospitalName}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {rec.destinationHospitalName}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200">
                                {rec.suggestedUnits}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Urgent / Critical Requests */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Urgent &amp; Critical Requests
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Prioritize hospitals with the most time-sensitive needs.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
                    {urgentRequests.length} active
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Hospital</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Units</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {urgentRequests.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={4}>
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
                                {req.blood_type}
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
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Donor Contact Suggestions
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
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
                        <span className="ml-3 inline-flex min-w-[3rem] items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
                          {d.bloodType}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Expiring Blood Action Suggestions */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-100/80">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-amber-900">
                      Expiring Blood Action Suggestions
                    </h2>
                    <p className="mt-1 text-[11px] text-amber-800">
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
                    {expiringActionSuggestions.slice(0, 15).map((item, idx) => (
                      <li
                        key={idx}
                        className="flex flex-col rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100"
                      >
                        <span className="font-semibold text-amber-900">
                          {item.bloodType} – {item.units} unit(s), {item.daysLeft} day(s) left
                        </span>
                        <span className="text-amber-800">
                          Suggested destination:{' '}
                          {item.suggestedHospital || 'high-demand hospital not identified yet'}
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
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Blood Shortage Forecast
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Estimate how long each blood type will last based on the last 30 days of usage.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {bloodShortageForecast.length} blood types tracked
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
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
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={4}>
                            No active inventory to forecast.
                          </td>
                        </tr>
                      ) : (
                        bloodShortageForecast.map((row, idx) => (
                          <tr
                            key={row.bloodType}
                            className={
                              'transition-colors hover:bg-slate-50 ' +
                              (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                            }
                          >
                            <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                              {row.bloodType}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {row.currentStock}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700">
                              {row.estimatedDaysRemaining === '—'
                                ? 'No recent usage'
                                : `${row.estimatedDaysRemaining} days`}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${getSupplyStatusClasses(
                                  row.status,
                                )}`}
                              >
                                {getSupplyStatusLabel(row.status)}
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
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Blood Usage Trends
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Compare which blood types are most frequently requested over time.
                    </p>
                  </div>
                </div>
                {bloodUsageTrendsData.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Not enough fulfilled requests to show usage trends.
                  </p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bloodUsageTrendsData}
                        margin={{ top: 16, right: 20, left: 0, bottom: 24 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="bloodType"
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
                        <Bar dataKey="unitsUsed" fill="#ef4444" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* Donor Availability Forecast */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Donor Availability Forecast
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
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
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Blood Expiry Risk Detection
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Identify blood types at highest risk of wastage in the next 7 days.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                    {expiringBloodList.length} blood types at risk
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">Blood</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Units Expiring Soon
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Min Days Left
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {expiringBloodList.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-500" colSpan={3}>
                            No units within the expiry threshold.
                          </td>
                        </tr>
                      ) : (
                        expiringBloodList.map((row, idx) => (
                          <tr
                            key={row.bloodType}
                            className={
                              'transition-colors hover:bg-slate-50 ' +
                              (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                            }
                          >
                            <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                              {row.bloodType}
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

