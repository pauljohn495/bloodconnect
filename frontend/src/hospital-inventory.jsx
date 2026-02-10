import HospitalLayout from './HospitalLayout.jsx'

function HospitalInventory() {
  return (
    <HospitalLayout
      pageTitle="Blood Inventory Management"
      pageDescription="View and manage your blood stock levels and inventory."
    >
      {/* Top stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-medium text-slate-500">O+ Units</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
          <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-medium text-slate-500">A+ Units</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
          <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-medium text-slate-500">B+ Units</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
          <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-medium text-slate-500">AB+ Units</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
          <p className="mt-1 text-[11px] text-slate-500">No data yet</p>
        </div>
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
            <button
              type="button"
              className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              Add Stock
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
                <tr>
                  <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={5}>
                    No inventory data available yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
          >
            Request Blood
          </button>
        </div>
      </section>
    </HospitalLayout>
  )
}

export default HospitalInventory

