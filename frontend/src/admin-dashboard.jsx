import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'

function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState(null)
  const [recentStocks, setRecentStocks] = useState([])
  const [allStocks, setAllStocks] = useState([])
  const [recentTransfers, setRecentTransfers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalAvailableBlood, setTotalAvailableBlood] = useState(0)
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true)
        const [summaryData, inventoryData, transfersData] = await Promise.all([
          apiRequest('/api/admin/dashboard-summary'),
          apiRequest('/api/admin/inventory'),
          apiRequest('/api/admin/transfers?limit=10'),
        ])

        setDashboardData(summaryData)
        
        // Sort all stocks by created_at DESC
        const sortedStocks = inventoryData.sort(
          (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
        )
        
        // Get recent stocks (last 10)
        setRecentStocks(sortedStocks.slice(0, 10))
        
        // Store all stocks for the modal
        setAllStocks(sortedStocks)

        // Set recent transfers
        setRecentTransfers(transfersData || [])

        // Calculate total available blood units
        const total = inventoryData.reduce((sum, item) => {
          const units = item.available_units ?? item.availableUnits ?? 0
          return sum + units
        }, 0)
        setTotalAvailableBlood(total)
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  return (
    <AdminLayout
      pageTitle="Dashboard overview"
      pageDescription="Monitor donors, requests, and hospital partners in real time."
    >
            {/* Top stats */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Active Donors</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {isLoading ? '—' : dashboardData?.counts?.totalDonors ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isLoading ? 'Loading...' : 'Registered donors'}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Available Blood</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {isLoading ? '—' : totalAvailableBlood}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isLoading ? 'Loading...' : 'Total blood units'}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Completed Donations</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {isLoading ? '—' : dashboardData?.counts?.completedDonations ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isLoading ? 'Loading...' : 'Total completed'}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Partner Hospitals</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {isLoading ? '—' : dashboardData?.counts?.partnerHospitals ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isLoading ? 'Loading...' : 'Active hospitals'}
                </p>
              </div>
            </section>

            {/* Main chart + recent stocks side panel */}
            <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)]">
              {/* Center chart placeholder */}
              <div className="flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="text-center px-6 py-10">
                  <p className="text-sm font-semibold text-slate-900">
                    Blood Stock Mapping
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    EMPTY
                  </p>
                </div>
              </div>

              {/* Recent blood stocks - right vertical card */}
              <div className="flex h-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Recent blood stocks</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsViewAllModalOpen(true)}
                    className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
                  >
                    View all
                  </button>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50/60">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                          Blood Type
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                          Units
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                          Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                          Expiration Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {isLoading && (
                        <tr>
                          <td className="px-4 py-6 text-center text-xs text-slate-500" colSpan={4}>
                            Loading recent stocks...
                          </td>
                        </tr>
                      )}

                      {!isLoading && recentStocks.length === 0 && (
                        <tr>
                          <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={4}>
                            No recent blood stocks yet.
                          </td>
                        </tr>
                      )}

                      {!isLoading &&
                        recentStocks.map((stock) => (
                          <tr key={stock.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-slate-900">
                              {stock.blood_type || stock.bloodType}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                              <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">
                                {stock.available_units ?? stock.availableUnits ?? stock.units ?? 0}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-xs">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold capitalize ring-1 ${
                                  stock.status === 'available'
                                    ? 'bg-green-50 text-green-700 ring-green-100'
                                    : stock.status === 'near_expiry' || stock.status === 'Near Expiry'
                                    ? 'bg-orange-50 text-orange-700 ring-orange-100'
                                    : stock.status === 'expired'
                                    ? 'bg-red-50 text-red-700 ring-red-100'
                                    : stock.status === 'reserved'
                                    ? 'bg-yellow-50 text-yellow-700 ring-yellow-100'
                                    : 'bg-slate-50 text-slate-700 ring-slate-100'
                                }`}
                              >
                                {stock.status === 'near_expiry' ? 'Near Expiry' : stock.status || 'available'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                              {stock.expiration_date || stock.expirationDate
                                ? new Date(stock.expiration_date || stock.expirationDate).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Recent Transferred Table */}
            <section className="mt-6">
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Recent Transferred</h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Recent blood stock transfers to hospitals
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50/60">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Blood Type
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Units Transferred
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Hospital
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Transferred By
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Transfer Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {isLoading && (
                        <tr>
                          <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                            Loading recent transfers...
                          </td>
                        </tr>
                      )}

                      {!isLoading && recentTransfers.length === 0 && (
                        <tr>
                          <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                            No transfers recorded yet.
                          </td>
                        </tr>
                      )}

                      {!isLoading &&
                        recentTransfers.map((transfer) => (
                          <tr key={transfer.id} className="hover:bg-slate-50/60 transition">
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">
                              {transfer.blood_type || transfer.bloodType}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-blue-50 px-2 py-1 text-[13px] font-semibold text-blue-700 ring-1 ring-blue-100">
                                {transfer.units_transferred || transfer.unitsTransferred || 0}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                              {transfer.hospital_name || transfer.hospitalName || '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                              {transfer.transferred_by_name || transfer.transferredByName || 'Admin'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                              {transfer.transfer_date || transfer.transferDate
                                ? new Date(transfer.transfer_date || transfer.transferDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

      {/* View All Modal */}
      {isViewAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex h-[85vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">All Blood Stocks</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Complete inventory of all blood stocks
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewAllModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/60 sticky top-0">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Blood Type
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Available Units
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Total Units
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Expiration Date
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Added Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                        Loading blood stocks...
                      </td>
                    </tr>
                  )}

                  {!isLoading && allStocks.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                        No blood stocks available yet.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    allStocks.map((stock) => (
                      <tr key={stock.id} className="hover:bg-slate-50/60 transition">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">
                          {stock.blood_type || stock.bloodType}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-emerald-50 px-2 py-1 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                            {stock.available_units ?? stock.availableUnits ?? 0}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">
                          {stock.units ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${
                              stock.status === 'available'
                                ? 'bg-green-50 text-green-700 ring-green-100'
                                : stock.status === 'near_expiry' || stock.status === 'Near Expiry'
                                ? 'bg-orange-50 text-orange-700 ring-orange-100'
                                : stock.status === 'expired'
                                ? 'bg-red-50 text-red-700 ring-red-100'
                                : stock.status === 'reserved'
                                ? 'bg-yellow-50 text-yellow-700 ring-yellow-100'
                                : 'bg-slate-50 text-slate-700 ring-slate-100'
                            }`}
                          >
                            {stock.status === 'near_expiry' ? 'Near Expiry' : stock.status || 'available'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {stock.expiration_date || stock.expirationDate
                            ? new Date(stock.expiration_date || stock.expirationDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {stock.created_at || stock.createdAt
                            ? new Date(stock.created_at || stock.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Total: <span className="font-semibold text-slate-900">{allStocks.length}</span> blood stock entries
                </p>
                <button
                  type="button"
                  onClick={() => setIsViewAllModalOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminDashboard


