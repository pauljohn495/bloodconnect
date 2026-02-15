import { useEffect, useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'

function HospitalInventory() {
  const [inventory, setInventory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [bloodTypeStats, setBloodTypeStats] = useState({})
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [bloodType, setBloodType] = useState('')
  const [unitsRequested, setUnitsRequested] = useState('')
  const [notes, setNotes] = useState('')
  const [notification, setNotification] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

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

  const handleOpenRequestModal = () => {
    setIsRequestModalOpen(true)
    setBloodType('')
    setUnitsRequested('')
    setNotes('')
  }

  const handleCloseRequestModal = () => {
    setIsRequestModalOpen(false)
    setBloodType('')
    setUnitsRequested('')
    setNotes('')
  }

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    if (!bloodType || !unitsRequested) {
      showNotification('Blood type and units requested are required', 'destructive')
      return
    }

    const units = parseInt(unitsRequested, 10)
    if (Number.isNaN(units) || units <= 0) {
      showNotification('Units requested must be a positive number', 'destructive')
      return
    }

    try {
      await apiRequest('/api/hospital/requests', {
        method: 'POST',
        body: JSON.stringify({
          bloodType,
          unitsRequested: units,
          notes: notes || null,
        }),
      })
      handleCloseRequestModal()
      showNotification('Blood request submitted successfully!', 'primary')
    } catch (err) {
      console.error('Failed to submit request', err)
      showNotification(err.message || 'Failed to submit blood request', 'destructive')
    }
  }

  // Filter inventory based on status
  const filteredInventory = inventory.filter((item) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'available') return item.status === 'available'
    if (statusFilter === 'near_expiry') return item.status === 'near_expiry' || item.status === 'Near Expiry'
    if (statusFilter === 'expired') return item.status === 'expired'
    return true
  })

  return (
    <HospitalLayout
      pageTitle="Blood Inventory Management"
      pageDescription="View and manage your blood stock levels and inventory."
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

      {/* Main inventory table */}
      <section className="mt-6 space-y-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Blood Inventory</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Complete inventory of all blood types and units
              </p>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="near_expiry">Near Expiry</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Blood Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Available Units
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Expiration Date
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={4}>
                      Loading inventory...
                    </td>
                  </tr>
                )}
                {!isLoading && inventory.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={4}>
                      No inventory data available yet.
                    </td>
                  </tr>
                )}
                {!isLoading && inventory.length > 0 && filteredInventory.filter((item) => (item.available_units || item.availableUnits || 0) > 0).length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={4}>
                      No items found with status "{statusFilter === 'near_expiry' ? 'Near Expiry' : statusFilter}".
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  filteredInventory
                    .filter((item) => (item.available_units || item.availableUnits || 0) > 0)
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
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                          {item.expiration_date
                            ? new Date(item.expiration_date).toLocaleDateString()
                            : item.expirationDate
                            ? new Date(item.expirationDate).toLocaleDateString()
                            : '—'}
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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleOpenRequestModal}
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
          >
            Request Blood
          </button>
        </div>
      </section>

      {/* Request Blood Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Request Blood</h3>
              <button
                type="button"
                onClick={handleCloseRequestModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                >
                  <option value="">Select blood type</option>
                  {bloodTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Units Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={unitsRequested}
                  onChange={(e) => setUnitsRequested(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter number of units"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Add any additional notes or requirements"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseRequestModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Container */}
      {notification && (
        <div className="fixed top-4 right-4 z-[200] transition-all duration-300 ease-in-out">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-[300px] max-w-md ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notification.type === 'destructive' ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="shrink-0 rounded p-1 transition hover:opacity-70 text-red-600 hover:bg-red-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </HospitalLayout>
  )
}

export default HospitalInventory

