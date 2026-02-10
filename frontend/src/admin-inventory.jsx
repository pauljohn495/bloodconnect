import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'

function AdminInventory() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bloodType, setBloodType] = useState('')
  const [units, setUnits] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [inventory, setInventory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadInventory = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/inventory')
      setInventory(data)
    } catch (err) {
      setError(err.message || 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setBloodType('')
    setUnits('')
    setExpirationDate('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          bloodType,
          units: Number(units),
          expirationDate,
        }),
      })
      // Refresh table so new stock appears immediately
      await loadInventory()
      handleCloseModal()
    } catch (err) {
      // You could surface this in the UI; for now just log
      console.error('Failed to add stock', err)
    }
  }

  return (
    <AdminLayout
      pageTitle="Inventory"
      pageDescription="Monitor and manage system-wide blood inventory."
    >
      <section className="mt-2">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Blood Inventory</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Complete inventory of all blood types and units
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
            >
              Add Stock
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Blood Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Available Units
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Expiration Date
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                      Loading inventory...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={4}>
                      {error}
                    </td>
                  </tr>
                )}

                {!isLoading && !error && inventory.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>
                      No inventory data available yet.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        {item.blood_type || item.bloodType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[13px] font-semibold text-red-700 ring-1 ring-red-100">
                          {item.available_units ?? item.availableUnits ?? item.units}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {item.expiration_date
                          ? new Date(item.expiration_date).toLocaleDateString()
                          : item.expirationDate
                          ? new Date(item.expirationDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm capitalize">
                        {item.status || 'available'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Stock</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Units
                </label>
                <input
                  type="number"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter number of units"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminInventory



