import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import HospitalSupplyMap from './HospitalSupplyMap.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

/** Small decorative icons for stat cards (stroke uses currentColor for theme contrast). */
function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconDroplet({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconCheckCircle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function IconBuilding({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12h4M6 16h4M6 8h4m4 8h4m-4-4h4m-4-4h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
          apiRequest('/api/admin/dashboard/summary'),
          apiRequest('/api/admin/inventory'),
          apiRequest('/api/admin/transfers?limit=10'),
        ])

        setDashboardData(summaryData)

        // Sort all stocks by created_at DESC
        const sortedStocks = inventoryData.sort(
          (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt),
        )

        // Filter out expired stocks for the "Recent blood stocks" widget and modal
        const nonExpiredStocks = sortedStocks.filter((item) => item.status !== 'expired')

        // Get recent stocks (last 10, non-expired only)
        setRecentStocks(nonExpiredStocks.slice(0, 10))

        // Store all non-expired stocks for the modal
        setAllStocks(nonExpiredStocks)

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
            {/* Top stats — clear cards, high contrast, calm clinical palette */}
            <section
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              aria-label="Dashboard summary statistics"
            >
              <article className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/30 ring-1 ring-slate-100/90 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Active donors
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                      {isLoading ? '—' : dashboardData?.counts?.totalDonors ?? 0}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {isLoading ? 'Loading...' : 'Registered in the system'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100">
                    <IconUsers className="h-5 w-5" />
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/30 ring-1 ring-slate-100/90 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Available blood
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                      {isLoading ? '—' : totalAvailableBlood}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {isLoading ? 'Loading...' : 'Total units in inventory'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                    <IconDroplet className="h-5 w-5" />
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/30 ring-1 ring-slate-100/90 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Completed donations
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                      {isLoading ? '—' : dashboardData?.counts?.completedDonations ?? 0}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {isLoading ? 'Loading...' : 'Successfully completed to date'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <IconCheckCircle className="h-5 w-5" />
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/30 ring-1 ring-slate-100/90 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Partner hospitals
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                      {isLoading ? '—' : dashboardData?.counts?.partnerHospitals ?? 0}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {isLoading ? 'Loading...' : 'Active partner facilities'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                    <IconBuilding className="h-5 w-5" />
                  </div>
                </div>
              </article>
            </section>

            {/* Main chart + recent stocks side panel */}
            <section className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)]">
              {/* Supply Mapping container */}
              <div className="min-w-0">
                <HospitalSupplyMap />
              </div>

              {/* Recent blood stocks - right vertical card (full-panel rose tint) */}
              <div className="flex min-h-[min(420px,55vh)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/90 lg:h-[420px] lg:min-h-[420px]">
                <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-rose-50/40 to-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Recent blood stocks</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Latest non-expired inventory entries</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsViewAllModalOpen(true)}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:self-auto sm:py-1.5"
                  >
                    View all
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain touch-pan-x bg-slate-50/30 [-webkit-overflow-scrolling:touch]">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50/95">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Blood Type
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Component
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Units
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Added Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {isLoading && (
                        <tr>
                          <td className="px-4 py-6 text-center text-xs text-slate-500" colSpan={5}>
                            Loading recent stocks...
                          </td>
                        </tr>
                      )}

                      {!isLoading && recentStocks.length === 0 && (
                        <tr>
                          <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={5}>
                            No recent blood stocks yet.
                          </td>
                        </tr>
                      )}

                      {!isLoading &&
                        recentStocks.map((stock) => (
                          <tr key={stock.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-slate-900">
                              <BloodTypeBadge type={stock.blood_type || stock.bloodType} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                              {(() => {
                                const component = stock.component_type || stock.componentType || 'whole_blood'
                                if (component === 'platelets') return 'Platelets'
                                if (component === 'plasma') return 'Plasma'
                                return 'Whole Blood'
                              })()}
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
                              {stock.created_at || stock.createdAt
                                ? new Date(stock.created_at || stock.createdAt).toLocaleDateString()
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
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/90">
                <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-sky-50/40 to-white px-4 py-3.5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Recent transfers</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Blood stock transfers to partner hospitals</p>
                  </div>
                </div>

                <div className="overflow-x-auto overscroll-x-contain touch-pan-x bg-slate-50/30 [-webkit-overflow-scrolling:touch]">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50/95">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Blood Type
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Units Transferred
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Hospital
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Transferred By
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Transfer Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
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
                              <BloodTypeBadge type={transfer.blood_type || transfer.bloodType} />
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
      <div className="fixed inset-0 z-1000 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]">
          <div
            className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-all-stocks-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-red-50/50 via-white to-white px-6 py-4">
              <div>
                <h3 id="dashboard-all-stocks-title" className="text-lg font-semibold text-slate-900">
                  All Blood Stocks
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Complete inventory of all blood stocks
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewAllModalOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400/50"
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
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Blood Type
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                      Component
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
                          <BloodTypeBadge type={stock.blood_type || stock.bloodType} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                          {(() => {
                            const component = stock.component_type || stock.componentType || 'whole_blood'
                            if (component === 'platelets') return 'Platelets'
                            if (component === 'plasma') return 'Plasma'
                            return 'Whole Blood'
                          })()}
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
            <div className="border-t border-slate-200/80 bg-slate-50/50 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Total:{' '}
                  <span className="font-semibold tabular-nums text-slate-900">{allStocks.length}</span> blood stock
                  entries
                </p>
                <button
                  type="button"
                  onClick={() => setIsViewAllModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-400/50"
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


