import { useEffect, useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from '../api.js'
import { adminPanel } from '../admin/admin-ui.jsx'
import { BloodTypeBadge } from '../BloodTypeBadge.jsx'

function HospitalBloodRequest() {
  const [bloodType, setBloodType] = useState('')
  const [componentType, setComponentType] = useState('whole_blood')
  const [unitsRequested, setUnitsRequested] = useState('')
  const [notes, setNotes] = useState('')
  const [requestPriority, setRequestPriority] = useState('normal')
  const [notification, setNotification] = useState(null)
  const [requests, setRequests] = useState([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(true)
  const [requestsError, setRequestsError] = useState('')
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [selectedRequestNotes, setSelectedRequestNotes] = useState(null)
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false)
  const [selectedTimelineRequest, setSelectedTimelineRequest] = useState(null)
  const [isConfirmingReceivedId, setIsConfirmingReceivedId] = useState(null)

  const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const loadRequests = async () => {
    try {
      setIsLoadingRequests(true)
      setRequestsError('')
      const data = await apiRequest('/api/hospital/requests')
      setRequests(data || [])
    } catch (err) {
      setRequestsError(err.message || 'Failed to load blood requests')
      console.error('Failed to load blood requests', err)
    } finally {
      setIsLoadingRequests(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const resetForm = () => {
    setBloodType('')
    setComponentType('whole_blood')
    setUnitsRequested('')
    setNotes('')
    setRequestPriority('normal')
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()

    if (!bloodType || !unitsRequested) {
      showNotification('Blood type and units requested are required', 'destructive')
      return
    }

    const units = parseInt(unitsRequested, 10)
    if (Number.isNaN(units) || units <= 0) {
      showNotification('Units requested must be a positive number', 'destructive')
      return
    }

    try {
      await apiRequest('/api/hospital/requests', {
        method: 'POST',
        body: JSON.stringify({
          bloodType,
          componentType,
          unitsRequested: units,
          notes: notes || null,
          priority: requestPriority,
        }),
      })
      showNotification('Blood request submitted successfully!', 'primary')
      resetForm()
      await loadRequests()
    } catch (err) {
      console.error('Failed to submit request', err)
      showNotification(err.message || 'Failed to submit blood request', 'destructive')
    }
  }

  const normalizedStatus = (status) => (status || '').toLowerCase()

  const activeRequests = requests.filter((request) => {
    const status = normalizedStatus(request.status)
    return status === 'pending' || status === 'approved' || status === 'delivered'
  })

  const getStatusColor = (status) => {
    switch (normalizedStatus(status)) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 ring-yellow-100'
      case 'approved':
        return 'bg-green-50 text-green-700 ring-green-100'
      case 'delivered':
        return 'bg-blue-50 text-blue-700 ring-blue-100'
      case 'received':
      case 'fulfilled':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      case 'rejected':
        return 'bg-red-50 text-red-700 ring-red-100'
      case 'cancelled':
        return 'bg-slate-50 text-slate-700 ring-slate-100'
      default:
        return 'bg-slate-50 text-slate-700 ring-slate-100'
    }
  }

  const getDisplayStatusLabel = (status) => {
    const s = normalizedStatus(status)
    if (s === 'fulfilled') return 'received'
    return s || 'pending'
  }

  const toDateLabel = (value) => {
    if (!value) return 'Not yet recorded'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not yet recorded'
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  const getCurrentTimelineStep = (status) => {
    const s = normalizedStatus(status)
    if (s === 'received' || s === 'fulfilled') return 4
    if (s === 'delivered') return 3
    if (s === 'approved') return 2
    return 1
  }

  const getTimelineStages = (request) => {
    const currentStep = getCurrentTimelineStep(request.status)
    const pendingAt = request.pending_at || request.request_date || request.created_at
    const approvedAt = request.approved_at || (currentStep >= 2 ? request.updated_at : null)
    const fallbackProgressAt = request.updated_at || approvedAt || pendingAt
    const deliveredAt =
      request.delivered_at ||
      request.fulfilled_at ||
      (normalizedStatus(request.status) === 'fulfilled' || currentStep >= 3 ? fallbackProgressAt : null)
    const receivedAt =
      request.received_at ||
      (normalizedStatus(request.status) === 'received' || normalizedStatus(request.status) === 'fulfilled'
        ? fallbackProgressAt
        : null)

    return [
      {
        key: 'pending',
        label: 'Pending',
        description: 'Hospital submitted the blood request.',
        reached: currentStep >= 1,
        timestamp: pendingAt,
      },
      {
        key: 'approved',
        label: 'Approved',
        description: 'Admin reviewed and approved the request.',
        reached: currentStep >= 2,
        timestamp: approvedAt,
      },
      {
        key: 'delivered',
        label: 'Delivered',
        description: 'Blood was prepared and delivered.',
        reached: currentStep >= 3,
        timestamp: deliveredAt,
      },
      {
        key: 'received',
        label: 'Received',
        description: 'Hospital confirmed blood receipt.',
        reached: currentStep >= 4,
        timestamp: receivedAt,
      },
    ]
  }

  const handleConfirmReceived = async (request) => {
    try {
      setIsConfirmingReceivedId(request.id)
      await apiRequest(`/api/hospital/requests/${request.id}/received`, { method: 'PATCH' })
      await loadRequests()
      if (selectedTimelineRequest?.id === request.id) {
        setIsTimelineModalOpen(false)
        setSelectedTimelineRequest(null)
      }
      showNotification('Blood receipt confirmed successfully.', 'primary')
    } catch (err) {
      console.error('Failed to confirm blood receipt', err)
      showNotification(err.message || 'Failed to confirm blood receipt', 'destructive')
    } finally {
      setIsConfirmingReceivedId(null)
    }
  }

  return (
    <HospitalLayout
      pageTitle="Blood Request"
      pageDescription="Submit a blood request to the blood bank."
    >
      <section className="mt-2">
        <div className={adminPanel.rose.outer}>
          <div className={adminPanel.rose.header}>
            <div>
              <h2 className={adminPanel.rose.title}>Request blood</h2>
              <p className={adminPanel.rose.subtitle}>
                Fill in the required details to submit a new blood request.
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Component Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={componentType}
                  onChange={(e) => setComponentType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="whole_blood">Whole Blood</option>
                  <option value="platelets">Platelets</option>
                  <option value="plasma">Plasma</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Request Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={requestPriority}
                  onChange={(e) => setRequestPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="normal">Normal - Standard request</option>
                  <option value="urgent">Urgent - Needed soon</option>
                  <option value="critical">Critical / Emergency - Immediate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="">Select blood type</option>
                  {bloodTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Units Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={unitsRequested}
                  onChange={(e) => setUnitsRequested(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Enter number of units"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Add any additional notes or requirements"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className={adminPanel.amber.outer}>
          <div className={adminPanel.amber.header}>
            <div>
              <h2 className={adminPanel.amber.title}>Blood requests</h2>
              <p className={adminPanel.amber.subtitle}>
                Pending requests are listed below.
              </p>
            </div>
          </div>

          <div className={adminPanel.amber.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className={adminPanel.amber.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Blood Type</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Component Type</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Units Requested</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Units Approved</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Request Date</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Priority</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Status</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Notes</th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left ${adminPanel.amber.th}`}>Tracking</th>
                </tr>
              </thead>
              <tbody className={adminPanel.amber.tbody}>
                {isLoadingRequests && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={9}>
                      Loading requests...
                    </td>
                  </tr>
                )}
                {!isLoadingRequests && requestsError && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-red-500" colSpan={9}>
                      {requestsError}
                    </td>
                  </tr>
                )}
                {!isLoadingRequests && !requestsError && activeRequests.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={9}>
                      No active blood requests yet.
                    </td>
                  </tr>
                )}
                {!isLoadingRequests &&
                  !requestsError &&
                  activeRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-xs font-semibold text-slate-900">
                        <BloodTypeBadge type={request.blood_type} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                        {request.component_type === 'whole_blood'
                          ? 'Whole Blood'
                          : request.component_type === 'platelets'
                          ? 'Platelets'
                          : request.component_type === 'plasma'
                          ? 'Plasma'
                          : 'Whole Blood'}
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
                        {request.request_date ? new Date(request.request_date).toLocaleDateString() : '—'}
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
                          {getDisplayStatusLabel(request.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-700">
                        {request.notes ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequestNotes(request)
                              setIsNotesModalOpen(true)
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200/90 bg-amber-50/80 text-amber-700 transition-all duration-200 hover:border-amber-300 hover:bg-amber-100/90 hover:text-amber-900"
                            title="View notes"
                            aria-label="View notes"
                          >
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTimelineRequest(request)
                            setIsTimelineModalOpen(true)
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isNotesModalOpen && selectedRequestNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Request notes</h3>
              <button type="button" onClick={() => setIsNotesModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words">
              {selectedRequestNotes.notes}
            </div>
          </div>
        </div>
      )}

      {isTimelineModalOpen && selectedTimelineRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Blood request tracking timeline</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Request ID: {selectedTimelineRequest.id} · Current status:{' '}
                  <span className="font-semibold capitalize text-slate-700">
                    {getDisplayStatusLabel(selectedTimelineRequest.status)}
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setIsTimelineModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close timeline">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {getTimelineStages(selectedTimelineRequest).map((stage, index, stages) => (
                <div key={stage.key} className="relative flex gap-3">
                  <div className="flex w-6 flex-col items-center">
                    <span
                      className={`mt-0.5 h-4 w-4 rounded-full ring-2 ring-offset-2 ${
                        stage.reached ? 'bg-red-600 ring-red-200' : 'bg-white ring-slate-300'
                      }`}
                    />
                    {index < stages.length - 1 && (
                      <span className={`mt-1 h-10 w-0.5 ${stage.reached ? 'bg-red-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                      {stage.key === 'received' && normalizedStatus(selectedTimelineRequest.status) === 'delivered' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmReceived(selectedTimelineRequest)}
                          disabled={isConfirmingReceivedId === selectedTimelineRequest.id}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition duration-200 hover:bg-red-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isConfirmingReceivedId === selectedTimelineRequest.id ? 'Saving...' : 'Received'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{stage.description}</p>
                    <p className={`mt-1 text-xs ${stage.reached ? 'text-slate-700' : 'text-slate-400'}`}>
                      {toDateLabel(stage.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-4 right-4 z-60 transition-all duration-300 ease-in-out">
          <div
            className={`flex min-w-[300px] max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
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
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className={`shrink-0 rounded p-1 transition hover:opacity-70 ${
                notification.type === 'destructive'
                  ? 'text-red-600 hover:bg-red-100'
                  : 'text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </HospitalLayout>
  )
}

export default HospitalBloodRequest
