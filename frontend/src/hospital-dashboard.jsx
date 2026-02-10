import HospitalLayout from './HospitalLayout.jsx'

function HospitalDashboard() {
  return (
    <HospitalLayout
      pageTitle="Dashboard overview"
      pageDescription="Monitor blood inventory, requests, and donations in real time."
    >
      {/* Top stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">


      </section>

      {/* Main table + side panel */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Blood requests table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 w-400">
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
                <tr>
                  <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={3}>
                    No recent blood donated yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </HospitalLayout>
  )
}

export default HospitalDashboard

