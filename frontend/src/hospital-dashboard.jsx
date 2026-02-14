import { useEffect, useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'

function HospitalDashboard() {
  const [inventory, setInventory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [bloodTypeStats, setBloodTypeStats] = useState({})

  const loadInventory = async () => {
    try {
      setIsLoading(true)
      const data = await apiRequest('/api/hospital/inventory')
      setInventory(data)
      
      // Calculate stats by blood type
      const stats = {}
      data.forEach((item) => {
        const bloodType = item.blood_type || item.bloodType
        if (!stats[bloodType]) {
          stats[bloodType] = 0
        }
        const units = item.available_units || item.availableUnits || 0
        if (item.status === 'available' && units > 0) {
          stats[bloodType] += units
        }
      })
      setBloodTypeStats(stats)
    } catch (err) {
      console.error('Failed to load inventory', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
    // Refresh every 30 seconds to get updated data
    const interval = setInterval(loadInventory, 30000)
    return () => clearInterval(interval)
  }, [])

  const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']

  return (
    <HospitalLayout
      pageTitle="Dashboard overview"
      pageDescription="Monitor blood inventory, requests, and donations in real time."
    >
      {/* Top stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {bloodTypes.slice(0, 4).map((type) => (
          <div key={type} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-medium text-slate-500">{type} Units</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {isLoading ? '—' : bloodTypeStats[type] || 0}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {isLoading ? 'Loading...' : bloodTypeStats[type] ? 'Available' : 'No stock'}
            </p>
          </div>
        ))}
      </section>

      {/* Main table */}
      <section className="mt-6">
        {/* Blood requests table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent blood donated</h2>
            </div>
            <button
              type="button"
              className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              View all
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Blood Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Units Donated
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={3}>
                      Loading...
                    </td>
                  </tr>
                )}
                {!isLoading && inventory.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={3}>
                      No recent blood donated yet.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  inventory
                    .filter((item) => (item.available_units || item.availableUnits || 0) > 0)
                    .slice(0, 10)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-900">
                          {item.blood_type || item.bloodType}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-emerald-50 px-2 py-1 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                            {item.available_units || item.availableUnits || 0}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${
                              item.status === 'available'
                                ? 'bg-green-50 text-green-700 ring-green-100'
                                : item.status === 'near_expiry' || item.status === 'Near Expiry'
                                ? 'bg-orange-50 text-orange-700 ring-orange-100'
                                : item.status === 'expired'
                                ? 'bg-red-50 text-red-700 ring-red-100'
                                : 'bg-slate-50 text-slate-700 ring-slate-100'
                            }`}
                          >
                            {item.status === 'near_expiry' ? 'Near Expiry' : item.status || 'available'}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </HospitalLayout>
  )
}

export default HospitalDashboard

