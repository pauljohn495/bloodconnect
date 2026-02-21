import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'

function AdminDonation() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [donorName, setDonorName] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [contactDonor, setContactDonor] = useState('')
  const [donors, setDonors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isScheduleRequestsModalOpen, setIsScheduleRequestsModalOpen] = useState(false)
  const [scheduleRequests, setScheduleRequests] = useState([])
  const [isScheduleRequestsLoading, setIsScheduleRequestsLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [isScheduleHistoryModalOpen, setIsScheduleHistoryModalOpen] = useState(false)
  const [scheduleHistory, setScheduleHistory] = useState([])
  const [isScheduleHistoryLoading, setIsScheduleHistoryLoading] = useState(false)
  const [previousModalOpen, setPreviousModalOpen] = useState(null) // Track which modal was open before details

  const loadDonors = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/donors')
      setDonors(data)
    } catch (err) {
      setError(err.message || 'Failed to load donors')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDonors()
  }, [])

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setDonorName('')
    setBloodType('')
    setContactDonor('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/admin/donors', {
        method: 'POST',
        body: JSON.stringify({
          donorName,
          bloodType,
          contactPhone: contactDonor,
        }),
      })
      // Refresh table so new donor appears immediately
      await loadDonors()
      handleCloseModal()
    } catch (err) {
      console.error('Failed to add donor', err)
    }
  }

  const loadScheduleRequests = async () => {
    try {
      setIsScheduleRequestsLoading(true)
      const data = await apiRequest('/api/admin/schedule-requests')
      // Filter to only show pending requests
      const pendingRequests = data.filter((req) => req.status === 'pending')
      setScheduleRequests(pendingRequests)
    } catch (err) {
      console.error('Failed to load schedule requests', err)
    } finally {
      setIsScheduleRequestsLoading(false)
    }
  }

  const loadScheduleHistory = async () => {
    try {
      setIsScheduleHistoryLoading(true)
      const data = await apiRequest('/api/admin/schedule-requests')
      // Filter to only show approved/rejected requests
      const historyRequests = data.filter(
        (req) => req.status === 'approved' || req.status === 'rejected',
      )
      setScheduleHistory(historyRequests)
    } catch (err) {
      console.error('Failed to load schedule history', err)
    } finally {
      setIsScheduleHistoryLoading(false)
    }
  }

  const handleOpenScheduleHistory = () => {
    setIsScheduleHistoryModalOpen(true)
    loadScheduleHistory()
  }

  const handleOpenScheduleRequests = () => {
    setIsScheduleRequestsModalOpen(true)
    loadScheduleRequests()
  }

  const handleViewDetails = async (requestId) => {
    try {
      // Track which modal was open before opening details
      if (isScheduleHistoryModalOpen) {
        setPreviousModalOpen('history')
      } else if (isScheduleRequestsModalOpen) {
        setPreviousModalOpen('requests')
      } else {
        setPreviousModalOpen(null)
      }

      const data = await apiRequest(`/api/admin/schedule-requests/${requestId}`)
      // Parse health screening answers if it's a string
      if (data.health_screening_answers && typeof data.health_screening_answers === 'string') {
        try {
          data.health_screening_answers = JSON.parse(data.health_screening_answers)
        } catch {
          data.health_screening_answers = {}
        }
      }
      setSelectedRequest(data)
      setIsDetailsModalOpen(true)
      // Close schedule history modal if it's open
      setIsScheduleHistoryModalOpen(false)
      // Close schedule requests modal if it's open
      setIsScheduleRequestsModalOpen(false)
    } catch (err) {
      console.error('Failed to load request details', err)
    }
  }

  const handleApprove = async (requestId) => {
    try {
      await apiRequest(`/api/admin/schedule-requests/${requestId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({
          adminNotes: adminNotes || null,
        }),
      })
      // Reload both pending requests and history
      await loadScheduleRequests()
      if (isScheduleHistoryModalOpen) {
        await loadScheduleHistory()
      }
      setIsDetailsModalOpen(false)
      setAdminNotes('')
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(null)
      }
      alert('Schedule request approved successfully')
    } catch (err) {
      console.error('Failed to approve request', err)
      alert(err.message || 'Failed to approve request')
    }
  }

  const handleReject = async (requestId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    try {
      await apiRequest(`/api/admin/schedule-requests/${requestId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({
          rejectionReason,
        }),
      })
      // Reload both pending requests and history
      await loadScheduleRequests()
      if (isScheduleHistoryModalOpen) {
        await loadScheduleHistory()
      }
      setIsDetailsModalOpen(false)
      setRejectionReason('')
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(null)
      }
      alert('Schedule request rejected successfully')
    } catch (err) {
      console.error('Failed to reject request', err)
      alert(err.message || 'Failed to reject request')
    }
  }

  return (
    <AdminLayout
      pageTitle="Donors"
      pageDescription="View and manage registered blood donors."
    >
      <section className="mt-2">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">List of Donors</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Overview of all registered donors
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenScheduleRequests}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Schedule Requests
              </button>
              <button
                type="button"
                onClick={handleOpenScheduleHistory}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Schedule History
              </button>
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
              >
                Add Donor
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Donor Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Blood Type
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Contact
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Last Donation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                      Loading donors...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={4}>
                      {error}
                    </td>
                  </tr>
                )}

                {!isLoading && !error && donors.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>
                      No donors added yet.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  donors.map((donor) => (
                    <tr key={donor.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        {donor.full_name || donor.fullName || donor.donor_name || donor.donorName || donor.username || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[13px] font-semibold text-red-700 ring-1 ring-red-100">
                          {donor.blood_type || donor.bloodType || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {donor.phone || donor.contact_phone || donor.contactPhone || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {donor.last_donation_date
                          ? new Date(donor.last_donation_date).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Donor</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Donor name
                </label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter donor full name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Contact Donor
                </label>
                <input
                  type="text"
                  value={contactDonor}
                  onChange={(e) => setContactDonor(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Phone number"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Save Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Requests Modal */}
      {isScheduleRequestsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Schedule Requests</h3>
              <button
                type="button"
                onClick={() => setIsScheduleRequestsModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isScheduleRequestsLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading schedule requests...</div>
            ) : scheduleRequests.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No schedule requests found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/60">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Donor Name
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Preferred Date & Time
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Component Type
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Submitted
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {scheduleRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                          {request.donor_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {new Date(request.preferred_date).toLocaleDateString()} at {request.preferred_time}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {request.component_type === 'whole_blood' ? 'Whole Blood' : request.component_type === 'platelets' ? 'Platelets' : request.component_type === 'plasma' ? 'Plasma' : 'Whole Blood'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                              request.status === 'approved'
                                ? 'bg-green-100 text-green-700 ring-green-200'
                                : request.status === 'rejected'
                                  ? 'bg-red-100 text-red-700 ring-red-200'
                                  : 'bg-yellow-100 text-yellow-700 ring-yellow-200'
                            }`}
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {new Date(request.created_at).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(request.id)}
                            className="text-red-600 hover:text-red-700 font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {isDetailsModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Request Details</h3>
              <button
                type="button"
                onClick={() => {
                  setIsDetailsModalOpen(false)
                  setSelectedRequest(null)
                  setRejectionReason('')
                  setAdminNotes('')
                  // Reopen the previous modal if one was open
                  if (previousModalOpen === 'history') {
                    setIsScheduleHistoryModalOpen(true)
                    setPreviousModalOpen(null)
                  } else if (previousModalOpen === 'requests') {
                    setIsScheduleRequestsModalOpen(true)
                    setPreviousModalOpen(null)
                  }
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Donor Info */}
              <div className="border-b border-slate-200 pb-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Donor Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Name:</span>
                    <span className="ml-2 font-medium text-slate-900">{selectedRequest.donor_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Email:</span>
                    <span className="ml-2 font-medium text-slate-900">{selectedRequest.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone:</span>
                    <span className="ml-2 font-medium text-slate-900">{selectedRequest.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Blood Type:</span>
                    <span className="ml-2 font-medium text-slate-900">{selectedRequest.blood_type || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Schedule Info */}
              <div className="border-b border-slate-200 pb-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Schedule Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Preferred Date:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {new Date(selectedRequest.preferred_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Preferred Time:</span>
                    <span className="ml-2 font-medium text-slate-900">{selectedRequest.preferred_time}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Component Type:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {selectedRequest.component_type === 'whole_blood' ? 'Whole Blood' : selectedRequest.component_type === 'platelets' ? 'Platelets' : selectedRequest.component_type === 'plasma' ? 'Plasma' : 'Whole Blood'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Donation Date:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {selectedRequest.last_donation_date
                        ? new Date(selectedRequest.last_donation_date).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Weight:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {selectedRequest.weight ? `${selectedRequest.weight} kg` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Health Screening */}
              {selectedRequest.health_screening_answers && (
                <div className="border-b border-slate-200 pb-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Health Screening Answers</h4>
                  <div className="space-y-2 text-sm">
                    {(() => {
                      let answers = selectedRequest.health_screening_answers
                      // Parse if it's a string
                      if (typeof answers === 'string') {
                        try {
                          answers = JSON.parse(answers)
                        } catch {
                          answers = {}
                        }
                      }
                      // Handle if it's already an object
                      if (typeof answers === 'object' && answers !== null) {
                        return Object.entries(answers).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-slate-500 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim()}:
                            </span>
                            <span className="ml-2 font-medium text-slate-900">
                              {value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value || '—'}
                            </span>
                          </div>
                        ))
                      }
                      return <div className="text-slate-500">No health screening answers available</div>
                    })()}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedRequest.notes && (
                <div className="border-b border-slate-200 pb-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Notes</h4>
                  <p className="text-sm text-slate-700">{selectedRequest.notes}</p>
                </div>
              )}

              {/* Status */}
              <div className="border-b border-slate-200 pb-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Status</h4>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    selectedRequest.status === 'approved'
                      ? 'bg-green-100 text-green-700 ring-green-200'
                      : selectedRequest.status === 'rejected'
                        ? 'bg-red-100 text-red-700 ring-red-200'
                        : 'bg-yellow-100 text-yellow-700 ring-yellow-200'
                  }`}
                >
                  {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                </span>
              </div>

              {/* Admin Actions */}
              {selectedRequest.status === 'pending' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Admin Notes (Optional)
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      placeholder="Add any notes for the donor..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Rejection Reason (Required for rejection)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      placeholder="Provide reason for rejection..."
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => handleReject(selectedRequest.id)}
                      className="inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              )}

              {/* Show admin notes and rejection reason if already reviewed */}
              {selectedRequest.status !== 'pending' && (
                <div className="space-y-2">
                  {selectedRequest.admin_notes && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-1">Admin Notes</h4>
                      <p className="text-sm text-slate-700">{selectedRequest.admin_notes}</p>
                    </div>
                  )}
                  {selectedRequest.rejection_reason && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-900 mb-1">Rejection Reason</h4>
                      <p className="text-sm text-red-700">{selectedRequest.rejection_reason}</p>
                    </div>
                  )}
                  {selectedRequest.reviewer_name && (
                    <div>
                      <span className="text-xs text-slate-500">Reviewed by:</span>
                      <span className="ml-2 text-xs font-medium text-slate-900">
                        {selectedRequest.reviewer_name}
                      </span>
                      {selectedRequest.reviewed_at && (
                        <span className="ml-2 text-xs text-slate-500">
                          on {new Date(selectedRequest.reviewed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule History Modal */}
      {isScheduleHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Schedule History</h3>
              <button
                type="button"
                onClick={() => setIsScheduleHistoryModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isScheduleHistoryLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading schedule history...</div>
            ) : scheduleHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No schedule history found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/60">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Donor Name
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Preferred Date & Time
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Component Type
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Reviewed At
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {scheduleHistory.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                          {request.donor_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {new Date(request.preferred_date).toLocaleDateString()} at {request.preferred_time}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {request.component_type === 'whole_blood' ? 'Whole Blood' : request.component_type === 'platelets' ? 'Platelets' : request.component_type === 'plasma' ? 'Plasma' : 'Whole Blood'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                              request.status === 'approved'
                                ? 'bg-green-100 text-green-700 ring-green-200'
                                : 'bg-red-100 text-red-700 ring-red-200'
                            }`}
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {request.reviewed_at
                            ? new Date(request.reviewed_at).toLocaleString()
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(request.id)}
                            className="text-red-600 hover:text-red-700 font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminDonation
