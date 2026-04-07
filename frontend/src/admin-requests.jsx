import { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

function AdminRequests() {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [notification, setNotification] = useState(null)
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [selectedRequestNotes, setSelectedRequestNotes] = useState(null)

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

  const handleOpenNotesModal = (request) => {
    setSelectedRequestNotes(request)
    setIsNotesModalOpen(true)
  }

  const handleCloseNotesModal = () => {
    setIsNotesModalOpen(false)
    setSelectedRequestNotes(null)
  }

  const formatNotesText = (notes) => {
    if (!notes) return ''

    // Split by sentence endings (period, question mark, exclamation mark)
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 0)

    if (sentences.length <= 3) {
      return notes
    }

    // Take first 3 sentences and join them back
    const firstThreeSentences = sentences.slice(0, 3)
    let result = firstThreeSentences.join('. ').trim()

    // Add period if not already there
    if (result && !result.match(/[.!?]$/)) {
      result += '.'
    }

    // Add remaining sentences with line breaks
    if (sentences.length > 3) {
      const remainingSentences = sentences.slice(3)
      result += '\n\n' + remainingSentences.join('. ').trim()
      if (remainingSentences.length > 0 && !result.match(/[.!?]$/)) {
        result += '.'
      }
    }

    return result
  }

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const handleUpdateStatus = async (requestId, status, unitsApproved = null, notes = null) => {
    try {
      await apiRequest(`/api/admin/requests/${requestId}`, {
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

  const getPriorityRank = (priority) => {
    if (priority === 'critical') return 3
    if (priority === 'urgent') return 2
    return 1 // normal or undefined
  }

  const pendingRequests = requests
    .filter((req) => req.status === 'pending')
    .filter((req) => {
      if (priorityFilter === 'all') return true
      const p = (req.priority || 'normal').toLowerCase()
      return p === priorityFilter
    })
    .slice()
    .sort((a, b) => {
      const pa = getPriorityRank((a.priority || 'normal').toLowerCase())
      const pb = getPriorityRank((b.priority || 'normal').toLowerCase())
      if (pa !== pb) return pb - pa // higher rank first (critical > urgent > normal)
      const da = a.request_date ? new Date(a.request_date) : 0
      const db = b.request_date ? new Date(b.request_date) : 0
      return da - db // older requests first within same priority
    })
  const allRequests = requests

  return (
    <AdminLayout
      pageTitle="Requests"
      pageDescription="Review and manage blood requests from hospitals"
    >
      <section className="mt-2">
        <div className={adminPanel.amber.outer}>
          <div className={adminPanel.amber.header}>
            <div>
              <h2 className={adminPanel.amber.title}>Hospital Blood Requests</h2>
              <p className={adminPanel.amber.subtitle}>
                Active requests from partner hospitals
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-[11px] font-medium text-slate-600">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="urgent">Urgent</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleOpenHistory}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                History
              </button>
            </div>
          </div>

          <div className={adminPanel.amber.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className={adminPanel.amber.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Hospital
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Blood Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Component Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Units Requested
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Request Date
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Priority
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Notes
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-xs ${adminPanel.amber.th}`}>
                    Status
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-right text-xs ${adminPanel.amber.th}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={adminPanel.amber.tbody}>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={9}>
                      Loading requests...
                    </td>
                  </tr>
                )}
                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-red-500" colSpan={9}>
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && pendingRequests.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={9}>
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
                        <BloodTypeBadge type={request.blood_type} />
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
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ${
                            (request.priority || 'normal') === 'critical'
                              ? 'bg-red-50 text-red-700 ring-red-100'
                              : (request.priority || 'normal') === 'urgent'
                              ? 'bg-orange-50 text-orange-700 ring-orange-100'
                              : 'bg-slate-50 text-slate-700 ring-slate-100'
                          }`}
                        >
                          {(request.priority || 'normal') === 'critical'
                            ? 'Critical'
                            : (request.priority || 'normal') === 'urgent'
                            ? 'Urgent'
                            : 'Normal'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                        {request.notes ? (
                          <button
                            type="button"
                            onClick={() => handleOpenNotesModal(request)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200/90 bg-amber-50/80 text-amber-700 transition-all duration-200 hover:border-amber-300 hover:bg-amber-100/90 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:ring-offset-1"
                            title="View notes"
                            aria-label="View notes"
                          >
                            <svg
                              className="h-4 w-4 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </button>
                        ) : (
                          '—'
                        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="requests-history-title"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4">
              <h3 id="requests-history-title" className="text-base font-semibold text-slate-900">
                Request history
              </h3>
              <p className="mt-1 text-sm text-slate-500">All hospital requests including completed statuses</p>
            </div>

            <div className="max-h-96 overflow-y-auto px-2">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Hospital
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Blood Type
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Component Type
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Units
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
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
                          <BloodTypeBadge type={request.blood_type} />
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

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 px-5 py-4">
              <button
                type="button"
                onClick={handleCloseHistory}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Container */}
      {notification && (
        <div className="fixed top-4 right-4 z-[60] transition-all duration-300 ease-in-out">
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

      {/* Notes Modal */}
      {isNotesModalOpen && selectedRequestNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Request notes</h3>
              <button
                type="button"
                onClick={handleCloseNotesModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-2">
                <strong>Hospital:</strong> {selectedRequestNotes.hospital_name}
              </div>
              <div className="text-xs text-slate-500 mb-2 flex flex-wrap items-center gap-2">
                <strong>Blood Type:</strong> <BloodTypeBadge type={selectedRequestNotes.blood_type} />
              </div>
              <div className="text-xs text-slate-500 mb-4">
                <strong>Request Date:</strong> {selectedRequestNotes.request_date ? new Date(selectedRequestNotes.request_date).toLocaleDateString() : 'N/A'}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-sm font-medium text-slate-900 mb-2">Notes:</h4>
              <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words">
                {formatNotesText(selectedRequestNotes.notes)}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCloseNotesModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminRequests

