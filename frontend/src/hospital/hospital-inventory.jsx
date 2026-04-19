import { useEffect, useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from '../api.js'
import { adminPanel } from '../admin/admin-ui.jsx'
import { BloodTypeBadge } from '../BloodTypeBadge.jsx'

function HospitalInventory() {
  const [inventory, setInventory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null)
  const [donateUnits, setDonateUnits] = useState('')
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [donationHistory, setDonationHistory] = useState([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const loadInventory = async () => {
    try {
      setIsLoading(true)
      const data = await apiRequest('/api/hospital/inventory')
      setInventory(data)
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

  const loadDonationHistory = async () => {
    try {
      setIsHistoryLoading(true)
      const data = await apiRequest('/api/hospital/donations')
      setDonationHistory(data || [])
    } catch (err) {
      console.error('Failed to load donation history', err)
      showNotification(err.message || 'Failed to load donation history', 'destructive')
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
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
      {/* Main inventory table */}
      <section className="space-y-4">
        <div className={adminPanel.rose.outer}>
          <div className={adminPanel.rose.header}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className={adminPanel.rose.title}>Blood inventory</h2>
                <p className={adminPanel.rose.subtitle}>
                  Complete inventory of all blood types and units
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsHistoryModalOpen(true)
                    await loadDonationHistory()
                  }}
                  className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"
                >
                  Donate history
                </button>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                >
                  <option value="all">All</option>
                  <option value="available">Available</option>
                  <option value="near_expiry">Near Expiry</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </div>

          <div className={adminPanel.rose.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className={adminPanel.rose.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.rose.th}`}>
                    Blood Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.rose.th}`}>
                    Component Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.rose.th}`}>
                    Available Units
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.rose.th}`}>
                    Expiration Date
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.rose.th}`}>
                    Status
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.rose.th}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={adminPanel.rose.tbody}>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={6}>
                      Loading inventory...
                    </td>
                  </tr>
                )}
                {!isLoading && inventory.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={6}>
                      No inventory data available yet.
                    </td>
                  </tr>
                )}
                {!isLoading && inventory.length > 0 && filteredInventory.filter((item) => (item.available_units || item.availableUnits || 0) > 0).length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={6}>
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
                          <BloodTypeBadge type={item.blood_type || item.bloodType} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                          {(item.component_type || item.componentType) === 'platelets' ? 'Platelets' : (item.component_type || item.componentType) === 'plasma' ? 'Plasma' : 'Whole Blood'}
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
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInventoryItem(item)
                              setDonateUnits('')
                              setIsDonateModalOpen(true)
                            }}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Record Donation
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Record Donation Modal */}
      {isDonateModalOpen && selectedInventoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Record Donation to Patient</h3>
              <button
                type="button"
                onClick={() => {
                  setIsDonateModalOpen(false)
                  setSelectedInventoryItem(null)
                  setDonateUnits('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="flex flex-wrap items-center gap-2 text-slate-700">
                <BloodTypeBadge type={selectedInventoryItem.blood_type || selectedInventoryItem.bloodType} />
                <span className="text-slate-500">·</span>
                <span>
                  {(selectedInventoryItem.component_type || selectedInventoryItem.componentType) === 'platelets'
                    ? 'Platelets'
                    : (selectedInventoryItem.component_type || selectedInventoryItem.componentType) === 'plasma'
                    ? 'Plasma'
                    : 'Whole Blood'}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                Available units:{' '}
                <span className="font-semibold">
                  {selectedInventoryItem.available_units || selectedInventoryItem.availableUnits || 0}
                </span>
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Units to record as donated <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedInventoryItem.available_units || selectedInventoryItem.availableUnits || 0}
                  value={donateUnits}
                  onChange={(e) => setDonateUnits(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Enter number of units"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDonateModalOpen(false)
                    setSelectedInventoryItem(null)
                    setDonateUnits('')
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!donateUnits) {
                      showNotification('Please enter units to record as donated', 'destructive')
                      return
                    }
                    const unitsInt = parseInt(donateUnits, 10)
                    const available =
                      selectedInventoryItem.available_units || selectedInventoryItem.availableUnits || 0
                    if (Number.isNaN(unitsInt) || unitsInt <= 0) {
                      showNotification('Units must be a positive number', 'destructive')
                      return
                    }
                    if (unitsInt > available) {
                      showNotification(
                        `Cannot donate more than available units (${available}).`,
                        'destructive',
                      )
                      return
                    }
                    try {
                      await apiRequest('/api/hospital/inventory/donate', {
                        method: 'POST',
                        body: JSON.stringify({
                          inventoryId: selectedInventoryItem.id,
                          units: unitsInt,
                        }),
                      })
                      setIsDonateModalOpen(false)
                      setSelectedInventoryItem(null)
                      setDonateUnits('')
                      showNotification('Donation recorded and inventory updated.', 'primary')
                      await loadInventory()
                    } catch (err) {
                      console.error('Failed to record donation', err)
                      showNotification(err.message || 'Failed to record donation', 'destructive')
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Donation History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Donate History</h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  Records of blood units donated to patients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              {isHistoryLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-500">Loading donate history...</p>
                </div>
              ) : donationHistory.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-500">No donate history recorded yet.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50/60">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                        Date
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                        Blood Type
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                        Component Type
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                        Units
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {donationHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                          {entry.donation_date
                            ? new Date(entry.donation_date).toLocaleString()
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-900">
                          <BloodTypeBadge type={entry.blood_type} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                          {entry.component_type === 'platelets'
                            ? 'Platelets'
                            : entry.component_type === 'plasma'
                            ? 'Plasma'
                            : 'Whole Blood'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                          {entry.units}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Container */}
      {notification && (
        <div className="fixed top-4 right-4 z-60 transition-all duration-300 ease-in-out">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-[300px] max-w-md ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
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
              className={`shrink-0 rounded p-1 transition hover:opacity-70 ${
                notification.type === 'destructive'
                  ? 'text-red-600 hover:bg-red-100'
                  : 'text-emerald-700 hover:bg-emerald-100'
              }`}
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

