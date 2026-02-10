import { useState } from 'react'
import AdminLayout from './AdminLayout.jsx'

function AdminReports() {
  const [activeTab, setActiveTab] = useState('analytics') // 'analytics' | 'reports'

  return (
    <AdminLayout
      pageTitle="Reports & Analytics"
      pageDescription="View detailed reports and system analytics."
    >
      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'analytics'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'reports'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Reports
        </button>
      </div>

      {/* Analytics content */}
      {activeTab === 'analytics' && (
        <section className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Analytics Overview</p>
            <p className="mt-1 text-[11px] text-slate-500">
              EMPTY
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Metric
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Value
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr>
                  <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={3}>
                    No analytics data yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reports content (existing charts) */}
      {activeTab === 'reports' && (
        <>
          {/* Top summary cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 h-28" />
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 h-28" />
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 h-28" />
          </section>

          {/* Line chart placeholder */}
          <section className="mt-6">
            <div className="flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 px-6 py-10">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">Line Chart</p>
                <p className="mt-2 text-[11px] text-slate-500">EMPTY</p>
              </div>
            </div>
          </section>

          {/* Bar and pie charts placeholders */}
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 px-6 py-10">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">Bar Chart</p>
                <p className="mt-2 text-[11px] text-slate-500">EMPTY</p>
              </div>
            </div>

            <div className="flex items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 px-6 py-10">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">Pie Chart</p>
                <p className="mt-2 text-[11px] text-slate-500">EMPTY</p>
              </div>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  )
}

export default AdminReports
