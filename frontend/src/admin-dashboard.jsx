import AdminLayout from './AdminLayout.jsx'

function AdminDashboard() {
  return (
    <AdminLayout
      pageTitle="Dashboard overview"
      pageDescription="Monitor donors, requests, and hospital partners in real time."
    >
            {/* Top stats */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Active Donors</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
                <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Available Blood</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
                <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Completed Donations</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
                <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs font-medium text-slate-500">Partner Hospitals</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
                <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
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
                          Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                          Expiration Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr>
                        <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={5}>
                          No recent blood stocks yet.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
    </AdminLayout>
  )
}

export default AdminDashboard


