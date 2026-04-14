import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import HospitalSupplyMap from './HospitalSupplyMap.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

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
  const [allStocks, setAllStocks] = useState([])
  const [recentTransfers, setRecentTransfers] = useState([])
  const [stockTrendData, setStockTrendData] = useState([])
  const [stockTrendRangeDays, setStockTrendRangeDays] = useState(30)
  const [requestTrendData, setRequestTrendData] = useState([])
  const [requestTrendRangeDays, setRequestTrendRangeDays] = useState(30)
  const [isLoading, setIsLoading] = useState(true)
  const [totalAvailableBlood, setTotalAvailableBlood] = useState(0)
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true)
        const [summaryData, inventoryData, transfersData, requestsData] = await Promise.all([
          apiRequest('/api/admin/dashboard/summary'),
          apiRequest('/api/admin/inventory'),
          apiRequest('/api/admin/transfers?limit=10'),
          apiRequest('/api/admin/requests'),
        ])

        setDashboardData(summaryData)

        // Sort all stocks by created_at DESC
        const sortedStocks = inventoryData.sort(
          (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt),
        )

        // Filter out expired stocks for the "Recent blood stocks" widget and modal
        const nonExpiredStocks = sortedStocks.filter((item) => item.status !== 'expired')

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

        const dayBuckets = new Map()
        for (const item of nonExpiredStocks) {
          const rawDate = item.created_at || item.createdAt
          if (!rawDate) continue
          const date = new Date(rawDate)
          if (Number.isNaN(date.getTime())) continue
          const key = date.toISOString().slice(0, 10)
          const units = Number(item.available_units ?? item.availableUnits ?? item.units ?? 0)
          dayBuckets.set(key, (dayBuckets.get(key) || 0) + (Number.isFinite(units) ? units : 0))
        }

        const today = new Date()
        const trend = []
        for (let i = 29; i >= 0; i -= 1) {
          const d = new Date(today)
          d.setHours(0, 0, 0, 0)
          d.setDate(d.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          trend.push({
            dateKey: key,
            dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            units: dayBuckets.get(key) || 0,
          })
        }
        setStockTrendData(trend)

        const requestBuckets = new Map()
        for (const req of requestsData || []) {
          const rawDate = req.request_date || req.requestDate || req.created_at || req.createdAt
          if (!rawDate) continue
          const date = new Date(rawDate)
          if (Number.isNaN(date.getTime())) continue
          const key = date.toISOString().slice(0, 10)
          requestBuckets.set(key, (requestBuckets.get(key) || 0) + 1)
        }

        const requestTrend = []
        for (let i = 29; i >= 0; i -= 1) {
          const d = new Date(today)
          d.setHours(0, 0, 0, 0)
          d.setDate(d.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          requestTrend.push({
            dateKey: key,
            dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count: requestBuckets.get(key) || 0,
          })
        }
        setRequestTrendData(requestTrend)
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
              <article className="group rounded-2xl border border-sky-300/40 bg-linear-to-br from-sky-400 via-sky-500 to-cyan-500 p-5 text-white shadow-[0_18px_36px_-24px_rgba(2,132,199,0.75)] ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(2,132,199,0.8)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-50/95">
                      Active donors
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      {isLoading ? '—' : dashboardData?.counts?.totalDonors ?? 0}
                    </p>
                    <p className="mt-1.5 text-xs text-sky-100/90">
                      {isLoading ? 'Loading...' : 'Registered in the system'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30">
                    <IconUsers className="h-5 w-5" />
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-orange-300/45 bg-linear-to-br from-orange-400 via-orange-500 to-amber-500 p-5 text-white shadow-[0_18px_36px_-24px_rgba(234,88,12,0.75)] ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(234,88,12,0.8)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-50/95">
                      Available blood
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      {isLoading ? '—' : totalAvailableBlood}
                    </p>
                    <p className="mt-1.5 text-xs text-orange-100/90">
                      {isLoading ? 'Loading...' : 'Total units in inventory'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30">
                    <IconDroplet className="h-5 w-5" />
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-violet-300/40 bg-linear-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-5 text-white shadow-[0_18px_36px_-24px_rgba(124,58,237,0.75)] ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(124,58,237,0.8)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-50/95">
                      Completed donations
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      {isLoading ? '—' : dashboardData?.counts?.completedDonations ?? 0}
                    </p>
                    <p className="mt-1.5 text-xs text-violet-100/90">
                      {isLoading ? 'Loading...' : 'Successfully completed to date'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30">
                    <IconCheckCircle className="h-5 w-5" />
                  </div>
                </div>
              </article>

              <article className="group rounded-2xl border border-rose-300/40 bg-linear-to-br from-rose-500 via-red-500 to-red-600 p-5 text-white shadow-[0_18px_36px_-24px_rgba(225,29,72,0.75)] ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-24px_rgba(225,29,72,0.8)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-50/95">
                      Partner hospitals
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      {isLoading ? '—' : dashboardData?.counts?.partnerHospitals ?? 0}
                    </p>
                    <p className="mt-1.5 text-xs text-rose-100/90">
                      {isLoading ? 'Loading...' : 'Active partner facilities'}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30">
                    <IconBuilding className="h-5 w-5" />
                  </div>
                </div>
              </article>
            </section>

            {/* Main chart + recent stocks side panel */}
            <section className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)]">
              {/* Supply Mapping container */}
              <div className="min-w-0 min-h-[580px] lg:min-h-[650px]">
                <HospitalSupplyMap />
              </div>

              <div className="flex min-h-[580px] flex-col gap-4 lg:min-h-[650px]">
                {/* Blood stock trend - top right card */}
                <div className="flex min-h-[min(360px,45vh)] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80 lg:h-[360px] lg:min-h-[360px]">
                  <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Blood stock trend</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Total available units over the last 7/30 days</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        <button
                          type="button"
                          onClick={() => setStockTrendRangeDays(7)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            stockTrendRangeDays === 7
                              ? 'bg-red-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          7D
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockTrendRangeDays(30)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            stockTrendRangeDays === 30
                              ? 'bg-red-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          30D
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsViewAllModalOpen(true)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:self-auto sm:py-1.5"
                      >
                        View all
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 bg-white p-3 sm:p-4">
                    {isLoading ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        Loading blood stock trend...
                      </div>
                    ) : stockTrendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No blood stock trend data yet.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={stockTrendData.slice(stockTrendData.length - stockTrendRangeDays)}
                          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip
                            formatter={(value) => [`${value} units`, 'Available blood']}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.dateKey || label}
                          />
                          <Line
                            type="monotone"
                            dataKey="units"
                            stroke="#dc2626"
                            strokeWidth={2.5}
                            dot={{ r: 2, fill: '#dc2626' }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Request trend - bottom right card */}
                <div className="flex min-h-[210px] flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80">
                  <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Request trend</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Hospital blood requests over the last 7/30 days</p>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setRequestTrendRangeDays(7)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          requestTrendRangeDays === 7
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        7D
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequestTrendRangeDays(30)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          requestTrendRangeDays === 30
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        30D
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 bg-white p-3 sm:p-4">
                    {isLoading ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        Loading request trend...
                      </div>
                    ) : requestTrendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No request trend data yet.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={requestTrendData.slice(requestTrendData.length - requestTrendRangeDays)}
                          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip
                            formatter={(value) => [`${value} requests`, 'Request count']}
                            labelFormatter={(label, payload) => payload?.[0]?.payload?.dateKey || label}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 2, fill: '#2563eb' }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Recent Transferred Table */}
            <section className="mt-6">
              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80">
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Recent transfers</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Blood stock transfers to partner hospitals</p>
                  </div>
                </div>

                <div className="overflow-x-auto overscroll-x-contain touch-pan-x bg-white [-webkit-overflow-scrolling:touch]">
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
            className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-all-stocks-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-6 py-4">
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
                <thead className="bg-slate-100/95">
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


