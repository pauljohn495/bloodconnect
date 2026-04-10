import { useEffect, useState, useMemo } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'
import { adminReportSection } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

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

  const { expirationAlerts } = useMemo(() => {
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

    return { expirationAlerts }
  }, [availableItems, today])

  const hasCritical = expirationAlerts.some((a) => a.isCritical)

  return (
    <HospitalLayout
      pageTitle="Reports & Analytics"
      pageDescription="Early detection for shortages and wastage risks."
    >
      <section className="space-y-6">
        <div className={adminReportSection.slate}>
          <div className="space-y-6">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading analytics...</div>
            ) : (
              <>
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
                            <span className={`flex flex-wrap items-center gap-1.5 ${alert.isCritical ? 'font-semibold text-red-900' : 'font-medium text-slate-800'}`}>
                              <span>Expiration Alert: {alert.units} unit(s) of</span>
                              <BloodTypeBadge type={alert.bloodType} />
                              <span>
                                {alert.componentLabel} will expire in {alert.daysLeft} day{alert.daysLeft !== 1 ? 's' : ''}
                              </span>
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
              </>
            )}
          </div>
        </div>
      </section>
    </HospitalLayout>
  )
}

export default HospitalReports
