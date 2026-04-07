import { useEffect, useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

function HospitalRequests() {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [selectedRequestNotes, setSelectedRequestNotes] = useState(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

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

  const handleOpenNotesModal = (request) => {
    setSelectedRequestNotes(request)
    setIsNotesModalOpen(true)
  }

  const handleCloseNotesModal = () => {
    setIsNotesModalOpen(false)
    setSelectedRequestNotes(null)
  }

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

  const normalizedStatus = (status) => (status || '').toLowerCase()
  const pendingRequests = requests.filter((request) => normalizedStatus(request.status) === 'pending')
  const historyRequests = requests.filter((request) =>
    ['approved', 'rejected', 'fulfilled'].includes(normalizedStatus(request.status)),
  )

  return (
    <HospitalLayout
      pageTitle="Blood Requests"
      pageDescription="View and track your blood requests status."
    >
      <section className="mt-2">
        <div className={adminPanel.amber.outer}>
          <div className={adminPanel.amber.header}>
            <div>
              <div>
                <h2 className={adminPanel.amber.title}>Blood requests</h2>
                <p className={adminPanel.amber.subtitle}>
                  Pending requests are listed below.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100"
              >
                History
              </button>
            </div>
          </div>

          <div className={adminPanel.amber.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className={adminPanel.amber.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Blood Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Component Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Units Requested
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Units Approved
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Request Date
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Priority
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Status
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className={adminPanel.amber.tbody}>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={8}>
                      Loading requests...
                    </td>
                  </tr>
                )}
                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-red-500" colSpan={8}>
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && pendingRequests.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={8}>
                      No pending blood requests. Submit a request from the Blood Request page.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  pendingRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50/60">
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
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${getStatusColor(
                            request.status,
                          )}`}
                        >
                          {request.status || 'pending'}
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
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="flex h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Request history</h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  Approved, rejected, and fulfilled requests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close history"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-500">Loading request history...</p>
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-red-500">{error}</p>
                </div>
              ) : historyRequests.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-500">No request history yet.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className={adminPanel.amber.thead}>
                    <tr>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Blood Type
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Component Type
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Units Requested
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Units Approved
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Request Date
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Priority
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className={adminPanel.amber.tbody}>
                    {historyRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50/60">
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
                        <td className="whitespace-nowrap px-4 py-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${getStatusColor(
                              request.status,
                            )}`}
                          >
                            {request.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </HospitalLayout>
  )
}

export default HospitalRequests

