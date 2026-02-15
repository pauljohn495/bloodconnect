import { useEffect, useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'

function HospitalRequests() {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRequests = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/hospital/requests')
      setRequests(data)
    } catch (err) {
      setError(err.message || 'Failed to load requests')
      console.error('Failed to load requests', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 ring-yellow-100'
      case 'approved':
        return 'bg-green-50 text-green-700 ring-green-100'
      case 'rejected':
        return 'bg-red-50 text-red-700 ring-red-100'
      case 'fulfilled':
        return 'bg-blue-50 text-blue-700 ring-blue-100'
      case 'cancelled':
        return 'bg-slate-50 text-slate-700 ring-slate-100'
      default:
        return 'bg-slate-50 text-slate-700 ring-slate-100'
    }
  }

  return (
    <HospitalLayout
      pageTitle="Blood Requests"
      pageDescription="View and track your blood requests status."
    >
      <section className="mt-2">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Blood Requests</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Track the status of your blood requests
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Blood Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Units Requested
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Units Approved
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Request Date
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={6}>
                      Loading requests...
                    </td>
                  </tr>
                )}
                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-red-500" colSpan={6}>
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && requests.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={6}>
                      No blood requests found. Submit a request from the Inventory page.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  requests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-900">
                        {request.blood_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[13px] font-semibold text-red-700 ring-1 ring-red-100">
                          {request.units_requested}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        {request.units_approved ? (
                          <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-green-50 px-2 py-1 text-[13px] font-semibold text-green-700 ring-1 ring-green-100">
                            {request.units_approved}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                        {request.request_date
                          ? new Date(request.request_date).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${getStatusColor(
                            request.status,
                          )}`}
                        >
                          {request.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {request.notes || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </HospitalLayout>
  )
}

export default HospitalRequests

