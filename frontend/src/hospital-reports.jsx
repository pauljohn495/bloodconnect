import { useEffect, useState, useMemo } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  LabelList,
} from 'recharts'

const NEAR_EXPIRY_DAYS = 7
const CRITICAL_EXPIRY_DAYS = 3

function componentLabel(componentType) {
  return componentType === 'platelets' ? 'Platelets' : componentType === 'plasma' ? 'Plasma' : 'Whole Blood'
}

function HospitalReports() {
  const [inventory, setInventory] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const loadInventory = async () => {
    try {
      setIsLoading(true)
      const data = await apiRequest('/api/hospital/inventory')
      setInventory(data)
    } catch (err) {
      console.error('Failed to load reports data', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
    const interval = setInterval(loadInventory, 30000)
    return () => clearInterval(interval)
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const availableItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          (item.status === 'available' || item.status === 'near_expiry') &&
          (item.available_units || item.availableUnits || 0) > 0,
      ),
    [inventory],
  )

  const wastageForecastData = useMemo(() => {
    const predictWastage = (days) => {
      return availableItems.reduce((sum, item) => {
        const exp = item.expiration_date || item.expirationDate
        if (!exp) return sum
        const expDate = new Date(exp)
        expDate.setHours(0, 0, 0, 0)
        const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
        if (daysLeft > 0 && daysLeft <= days) {
          return sum + (item.available_units || item.availableUnits || 0)
        }
        return sum
      }, 0)
    }
    return [
      { period: 'Next 7 Days', predicted: predictWastage(7) },
      { period: 'Next 14 Days', predicted: predictWastage(14) },
      { period: 'Next 30 Days', predicted: predictWastage(30) },
    ]
  }, [availableItems, today])

  const { expirationAlerts, summaryByType } = useMemo(() => {
    const byKey = {}
    availableItems.forEach((item) => {
      const bt = item.blood_type || item.bloodType
      const ct = item.component_type || item.componentType || 'whole_blood'
      const key = `${bt}_${ct}`
      if (!byKey[key]) {
        byKey[key] = { bloodType: bt, componentType: ct, totalUnits: 0, expiring: [] }
      }
      const units = item.available_units || item.availableUnits || 0
      byKey[key].totalUnits += units
      const exp = item.expiration_date || item.expirationDate
      if (exp) {
        const expDate = new Date(exp)
        expDate.setHours(0, 0, 0, 0)
        const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
        if (daysLeft >= 0 && daysLeft <= NEAR_EXPIRY_DAYS) {
          byKey[key].expiring.push({ units, daysLeft })
        }
      }
    })

    const expirationAlerts = []
    Object.values(byKey).forEach((group) => {
      group.expiring.forEach(({ units, daysLeft }) => {
        const comp = componentLabel(group.componentType)
        expirationAlerts.push({
          bloodType: group.bloodType,
          componentType: group.componentType,
          componentLabel: comp,
          units,
          daysLeft,
          isCritical: daysLeft <= CRITICAL_EXPIRY_DAYS,
        })
      })
    })
    expirationAlerts.sort((a, b) => a.daysLeft - b.daysLeft)

    return {
      expirationAlerts,
      summaryByType: Object.values(byKey).sort((a, b) => a.bloodType.localeCompare(b.bloodType) || a.componentType.localeCompare(b.componentType)),
    }
  }, [availableItems, today])

  const hasCritical = expirationAlerts.some((a) => a.isCritical)

  return (
    <HospitalLayout
      pageTitle="Reports & Analytics"
      pageDescription="Early detection for shortages and wastage risks."
    >
      <section className="space-y-6">
        {/* Early Detection System - Analytics */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">Analytics — Early Detection System</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Predicted wastage forecast and expiration alerts based on current inventory. Updates every 30 seconds.
            </p>
          </div>

          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading analytics...</div>
            ) : (
              <>
                {/* Predicted Wastage Forecast - same style as admin reports */}
                <div className="mb-8">
                  <h3 className="mb-4 text-sm font-semibold text-slate-900">Predicted Wastage Forecast</h3>
                  <p className="mb-4 text-[11px] text-slate-500">
                    Units at risk of expiration (wastage) in the next 7, 14, and 30 days based on current inventory.
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={wastageForecastData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                        stroke="#64748b"
                        tickLine={{ stroke: '#64748b' }}
                      >
                        <Label value="Time Period" offset={-5} position="insideBottom" style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} />
                      </XAxis>
                      <YAxis
                        tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                        stroke="#64748b"
                        tickLine={{ stroke: '#64748b' }}
                      >
                        <Label
                          value="Predicted Units"
                          angle={-90}
                          position="insideLeft"
                          style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }}
                        />
                      </YAxis>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 500,
                          padding: '10px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value) => [`${value} units`, 'Predicted Wastage']}
                        labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '10px' }} />
                      <Bar
                        dataKey="predicted"
                        fill="#dc2626"
                        radius={[6, 6, 0, 0]}
                        name="Predicted Wastage (units)"
                      >
                        <LabelList
                          dataKey="predicted"
                          position="top"
                          style={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }}
                          formatter={(value) => `${value}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Expiration / Wastage Alerts */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Expiration Alerts</h3>

                  {expirationAlerts.length === 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                      No units expiring within {NEAR_EXPIRY_DAYS} days.
                    </div>
                  )}

                  {/* Expiration / Wastage Warnings */}
                  {expirationAlerts.length > 0 && (
                    <div className={`rounded-xl border p-4 ${hasCritical ? 'border-amber-200 bg-amber-50/80' : 'border-amber-200 bg-amber-50/60'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Expiration / Wastage Risk</span>
                      </div>
                      <ul className="space-y-2">
                        {expirationAlerts.map((alert, i) => (
                          <li
                            key={`exp-${i}`}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                              alert.isCritical ? 'bg-red-50 border-red-200' : 'bg-white/80 border-amber-100'
                            }`}
                          >
                            <span
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${alert.isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                              aria-hidden
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                            <span className={alert.isCritical ? 'font-semibold text-red-900' : 'font-medium text-slate-800'}>
                              Expiration Alert: {alert.units} unit(s) of {alert.bloodType} {alert.componentLabel} will expire in {alert.daysLeft} day{alert.daysLeft !== 1 ? 's' : ''}
                            </span>
                            {alert.isCritical && (
                              <span className="ml-auto rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-800">Critical</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Summary by blood type + component (highlight critical) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Stock by blood type & component</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50/60">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">Blood Type</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">Component</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">Available Units</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {summaryByType.length === 0 && (
                          <tr>
                            <td className="px-3 py-6 text-center text-slate-500" colSpan={4}>No inventory data</td>
                          </tr>
                        )}
                        {summaryByType.map((row) => {
                          const hasExpiring = row.expiring.length > 0
                          const isCritical = row.expiring.some((e) => e.daysLeft <= CRITICAL_EXPIRY_DAYS)
                          return (
                            <tr
                              key={`${row.bloodType}_${row.componentType}`}
                              className={isCritical ? 'bg-red-50/50' : ''}
                            >
                              <td className={`whitespace-nowrap px-3 py-2 font-semibold ${isCritical ? 'text-red-900' : 'text-slate-900'}`}>
                                {row.bloodType}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                {componentLabel(row.componentType)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                  {row.totalUnits}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                {hasExpiring && (
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isCritical ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Near expiry
                                  </span>
                                )}
                                {!hasExpiring && <span className="text-slate-500">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </HospitalLayout>
  )
}

export default HospitalReports
