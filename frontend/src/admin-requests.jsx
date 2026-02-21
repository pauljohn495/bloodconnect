import { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'

function AdminRequests() {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [notification, setNotification] = useState(null)

  const loadRequests = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/requests')
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

  const handleOpenHistory = () => {
    setIsHistoryOpen(true)
  }

  const handleCloseHistory = () => {
    setIsHistoryOpen(false)
  }

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const handleUpdateStatus = async (requestId, status, unitsApproved = null, notes = null) => {
    try {
      await apiRequest(`/api/admin/requests/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          unitsApproved,
          notes,
        }),
      })
      await loadRequests()
      showNotification(`Request ${status} successfully!`, 'primary')
    } catch (err) {
      console.error('Failed to update request status', err)
      showNotification(err.message || 'Failed to update request status', 'destructive')
    }
  }

  const pendingRequests = requests.filter((req) => req.status === 'pending')
  const allRequests = requests

  return (
    <AdminLayout
      pageTitle="Requests"
      pageDescription="Review and manage blood requests from hospitals"
    >
      <section className="mt-2">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Hospital Blood Requests</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Active requests from partner hospitals
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenHistory}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
            >
              History
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Hospital
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Blood Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Component Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Units Requested
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Request Date
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={7}>
                      Loading requests...
                    </td>
                  </tr>
                )}
                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-red-500" colSpan={7}>
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && pendingRequests.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={7}>
                      No pending hospital requests.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  pendingRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-900">
                        {request.hospital_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-900">
                        {request.blood_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                        {request.component_type === 'whole_blood' ? 'Whole Blood' : request.component_type === 'platelets' ? 'Platelets' : request.component_type === 'plasma' ? 'Plasma' : 'Whole Blood'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[13px] font-semibold text-red-700 ring-1 ring-red-100">
                          {request.units_requested}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                        {request.request_date
                          ? new Date(request.request_date).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${
                            request.status === 'pending'
                              ? 'bg-yellow-50 text-yellow-700 ring-yellow-100'
                              : request.status === 'approved'
                              ? 'bg-green-50 text-green-700 ring-green-100'
                              : request.status === 'rejected'
                              ? 'bg-red-50 text-red-700 ring-red-100'
                              : request.status === 'fulfilled'
                              ? 'bg-blue-50 text-blue-700 ring-blue-100'
                              : 'bg-slate-50 text-slate-700 ring-slate-100'
                          }`}
                        >
                          {request.status || 'pending'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(request.id, 'approved', request.units_requested)}
                            className="inline-flex items-center justify-center rounded-full bg-green-600 px-3 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-green-500"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(request.id, 'rejected')}
                            className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-red-500"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">History of Hospital Requests</h3>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50/60 sticky top-0">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                      Hospital
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                      Blood Type
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                      Component Type
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                      Units
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {allRequests.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                        No request history available.
                      </td>
                    </tr>
                  ) : (
                    allRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-900">
                          {request.hospital_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-900">
                          {request.blood_type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
                          {request.component_type === 'whole_blood' ? 'Whole Blood' : request.component_type === 'platelets' ? 'Platelets' : request.component_type === 'plasma' ? 'Plasma' : 'Whole Blood'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
                          {request.units_requested}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
                          {request.request_date
                            ? new Date(request.request_date).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold capitalize ring-1 ${
                              request.status === 'pending'
                                ? 'bg-yellow-50 text-yellow-700 ring-yellow-100'
                                : request.status === 'approved'
                                ? 'bg-green-50 text-green-700 ring-green-100'
                                : request.status === 'rejected'
                                ? 'bg-red-50 text-red-700 ring-red-100'
                                : request.status === 'fulfilled'
                                ? 'bg-blue-50 text-blue-700 ring-blue-100'
                                : 'bg-slate-50 text-slate-700 ring-slate-100'
                            }`}
                          >
                            {request.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleCloseHistory}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Container */}
      {notification && (
        <div className="fixed top-4 right-4 z-[200] transition-all duration-300 ease-in-out">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-[300px] max-w-md ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-green-200 bg-green-50 text-green-800'
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
              className="shrink-0 rounded p-1 transition hover:opacity-70"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminRequests

