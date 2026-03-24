import { useEffect, useRef, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

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
  const [feedbackModal, setFeedbackModal] = useState({ open: false, message: '' })
  const [isDonorDetailsOpen, setIsDonorDetailsOpen] = useState(false)
  const [selectedDonorDetails, setSelectedDonorDetails] = useState(null)
  const [donorSearch, setDonorSearch] = useState('')
  const [notification, setNotification] = useState(null)
  const [openMenuDonorId, setOpenMenuDonorId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRefs = useRef({})
  const [isEditDonorModalOpen, setIsEditDonorModalOpen] = useState(false)
  const [editingDonor, setEditingDonor] = useState(null)
  const [editDonorName, setEditDonorName] = useState('')
  const [editBloodType, setEditBloodType] = useState('')
  const [editContactDonor, setEditContactDonor] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [isDeleteDonorModalOpen, setIsDeleteDonorModalOpen] = useState(false)
  const [donorToDelete, setDonorToDelete] = useState(null)
  const [isDeletingDonor, setIsDeletingDonor] = useState(false)

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

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

  useEffect(() => {
    const handleScroll = () => {
      if (openMenuDonorId) setOpenMenuDonorId(null)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openMenuDonorId])

  const donorNameForSearch = (donor) =>
    (
      donor.full_name ||
      donor.fullName ||
      donor.donor_name ||
      donor.donorName ||
      donor.username ||
      ''
    )
      .toString()
      .toLowerCase()

  const filteredDonors = donors.filter((donor) => {
    const q = donorSearch.trim().toLowerCase()
    if (!q) return true
    return donorNameForSearch(donor).includes(q)
  })

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
      showNotification('Donor added successfully!', 'primary')
    } catch (err) {
      console.error('Failed to add donor', err)
      showNotification(err.message || 'Failed to add donor', 'destructive')
    }
  }

  const loadScheduleRequests = async () => {
    try {
      setIsScheduleRequestsLoading(true)
      const data = await apiRequest('/api/admin/schedule-requests')
      // Filter to only show pending and approved requests
      const pendingRequests = data.filter((req) => req.status === 'pending' || req.status === 'approved')
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
      // Filter to only show completed/rejected requests
      const historyRequests = data.filter(
        (req) => req.status === 'completed' || req.status === 'rejected',
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
      setFeedbackModal({
        open: true,
        message: 'Schedule request approved successfully',
      })
    } catch (err) {
      console.error('Failed to approve request', err)
      setFeedbackModal({
        open: true,
        message: err.message || 'Failed to approve request',
      })
    }
  }

  const handleComplete = async (requestId) => {
    try {
      await apiRequest(`/api/admin/schedule-requests/${requestId}/complete`, {
        method: 'PATCH',
      })
      // Reload both pending requests and history
      await loadScheduleRequests()
      if (isScheduleHistoryModalOpen) {
        await loadScheduleHistory()
      }
      setIsDetailsModalOpen(false)
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(null)
      }
      setFeedbackModal({
        open: true,
        message: 'Schedule request completed successfully',
      })
    } catch (err) {
      console.error('Failed to complete request', err)
      setFeedbackModal({
        open: true,
        message: err.message || 'Failed to complete request',
      })
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

  const loadDonorDetails = async (donorId) => {
    try {
      const data = await apiRequest(`/api/admin/donors/${donorId}/details`)
      setSelectedDonorDetails(data)
      setIsDonorDetailsOpen(true)
    } catch (err) {
      console.error('Failed to load donor details', err)
      alert(err.message || 'Failed to load donor details')
    }
  }

  const handleOpenEditDonorModal = (donor) => {
    setOpenMenuDonorId(null)
    setEditingDonor(donor)
    setEditDonorName(donor.full_name || donor.fullName || donor.donor_name || donor.donorName || '')
    setEditBloodType(donor.blood_type || donor.bloodType || '')
    setEditContactDonor(donor.phone || donor.contact_phone || donor.contactPhone || '')
    setEditStatus(donor.status || 'active')
    setIsEditDonorModalOpen(true)
  }

  const handleCloseEditDonorModal = () => {
    setIsEditDonorModalOpen(false)
    setEditingDonor(null)
    setEditDonorName('')
    setEditBloodType('')
    setEditContactDonor('')
    setEditStatus('active')
  }

  const handleUpdateDonor = async (e) => {
    e.preventDefault()
    if (!editingDonor) return
    try {
      await apiRequest(`/api/admin/donors/${editingDonor.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          donorName: editDonorName,
          bloodType: editBloodType,
          contactPhone: editContactDonor,
          status: editStatus,
        }),
      })
      await loadDonors()
      handleCloseEditDonorModal()
      showNotification('Donor updated successfully', 'primary')
    } catch (err) {
      console.error('Failed to update donor', err)
      showNotification(err.message || 'Failed to update donor', 'destructive')
    }
  }

  const handleOpenDeleteDonorModal = (donor) => {
    setOpenMenuDonorId(null)
    setDonorToDelete(donor)
    setIsDeleteDonorModalOpen(true)
  }

  const handleCloseDeleteDonorModal = () => {
    setIsDeleteDonorModalOpen(false)
    setDonorToDelete(null)
    setIsDeletingDonor(false)
  }

  const handleConfirmDeleteDonor = async () => {
    if (!donorToDelete) return
    try {
      setIsDeletingDonor(true)
      await apiRequest(`/api/admin/donors/${donorToDelete.id}`, { method: 'DELETE' })
      await loadDonors()
      handleCloseDeleteDonorModal()
      showNotification('Donor deleted successfully', 'primary')
    } catch (err) {
      console.error('Failed to delete donor', err)
      showNotification(err.message || 'Failed to delete donor', 'destructive')
      setIsDeletingDonor(false)
    }
  }

  return (
    <AdminLayout
      pageTitle="Donors"
      pageDescription="View and manage registered blood donors."
    >
      <section className="mt-2">
        <div className={adminPanel.emerald.outer}>
          <div className={adminPanel.emerald.header}>
            <div>
              <h2 className={adminPanel.emerald.title}>List of Donors</h2>
              <p className={adminPanel.emerald.subtitle}>
                Overview of all registered donors
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <input
                  value={donorSearch}
                  onChange={(e) => setDonorSearch(e.target.value)}
                  placeholder="Search donor name..."
                  className="w-56 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
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
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Add Donor
              </button>
            </div>
          </div>

          <div className={adminPanel.emerald.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className={adminPanel.emerald.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                    Donor Name
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                    Blood Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                    Contact
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                    Status
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-right text-[13px] ${adminPanel.emerald.th}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={adminPanel.emerald.tbody}>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                      Loading donors...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={5}>
                      {error}
                    </td>
                  </tr>
                )}

                {!isLoading && !error && donors.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      No donors added yet.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  filteredDonors.map((donor) => (
                    <tr key={donor.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        {donor.full_name || donor.fullName || donor.donor_name || donor.donorName || donor.username || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        <BloodTypeBadge type={donor.blood_type || donor.bloodType} className="text-[13px]" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {donor.phone || donor.contact_phone || donor.contactPhone || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${donor.status === 'active'
                              ? 'bg-green-100 text-green-700 ring-green-200'
                              : donor.status === 'inactive'
                                ? 'bg-red-100 text-red-700 ring-red-200'
                                : 'bg-slate-100 text-slate-700 ring-slate-200'
                            }`}
                        >
                          {donor.status ? donor.status.charAt(0).toUpperCase() + donor.status.slice(1) : 'Active'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                        <div className="relative inline-block text-left">
                          <button
                            ref={(el) => (buttonRefs.current[donor.id] = el)}
                            type="button"
                            onClick={() => {
                              const button = buttonRefs.current[donor.id]
                              if (button) {
                                const rect = button.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + 8,
                                  right: window.innerWidth - rect.right,
                                })
                              }
                              setOpenMenuDonorId((prev) => (prev === donor.id ? null : donor.id))
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            aria-haspopup="menu"
                            aria-expanded={openMenuDonorId === donor.id}
                            aria-label="Open donor actions menu"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6.5h.01M12 12h.01M12 17.5h.01"
                              />
                            </svg>
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
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Save Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openMenuDonorId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuDonorId(null)} />
          <div
            className="fixed z-50 w-44 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-slate-200 focus:outline-none"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
            role="menu"
            aria-label="Donor actions"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                role="menuitem"
                onClick={() => {
                  const selectedDonor = donors.find((entry) => entry.id === openMenuDonorId)
                  if (selectedDonor) loadDonorDetails(selectedDonor.id)
                  setOpenMenuDonorId(null)
                }}
              >
                View Details
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                role="menuitem"
                onClick={() => {
                  const selectedDonor = donors.find((entry) => entry.id === openMenuDonorId)
                  if (selectedDonor) handleOpenEditDonorModal(selectedDonor)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                role="menuitem"
                onClick={() => {
                  const selectedDonor = donors.find((entry) => entry.id === openMenuDonorId)
                  if (selectedDonor) handleOpenDeleteDonorModal(selectedDonor)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
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
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${request.status === 'approved' || request.status === 'completed'
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

      {isEditDonorModalOpen && editingDonor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Edit Donor</h3>
              <button
                type="button"
                onClick={handleCloseEditDonorModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateDonor} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Donor Name</label>
                <input
                  type="text"
                  value={editDonorName}
                  onChange={(e) => setEditDonorName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Blood Type</label>
                <select
                  value={editBloodType}
                  onChange={(e) => setEditBloodType(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700">Contact Number</label>
                <input
                  type="text"
                  value={editContactDonor}
                  onChange={(e) => setEditContactDonor(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditDonorModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteDonorModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Delete Donor</h3>
              <button
                type="button"
                onClick={handleCloseDeleteDonorModal}
                className="text-slate-400 hover:text-slate-600"
                disabled={isDeletingDonor}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-900">Are you sure you want to delete this donor account?</p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Name:</span>{' '}
                {donorToDelete?.full_name || donorToDelete?.fullName || donorToDelete?.donor_name || donorToDelete?.donorName || '—'}
              </p>
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Contact:</span>{' '}
                {donorToDelete?.phone || donorToDelete?.contact_phone || donorToDelete?.contactPhone || '—'}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCloseDeleteDonorModal}
                disabled={isDeletingDonor}
                className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDonor}
                disabled={isDeletingDonor}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeletingDonor ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {isDetailsModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">Blood Type:</span>
                    <BloodTypeBadge type={selectedRequest.blood_type} className="text-sm" />
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
                        const entries = Object.entries(answers)
                        if (entries.length === 0) {
                          return (
                            <div className="text-slate-500">
                              No health screening answers available
                            </div>
                          )
                        }
                        return entries.map(([key, value]) => (
                          <div key={key}>
                            <span className="text-slate-500 capitalize">
                              {key
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/^./, (str) => str.toUpperCase())
                                .trim()}
                              :
                            </span>
                            <span className="ml-2 font-medium text-slate-900">
                              {value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value || '—'}
                            </span>
                          </div>
                        ))
                      }
                      return (
                        <div className="text-slate-500">No health screening answers available</div>
                      )
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
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${selectedRequest.status === 'approved' || selectedRequest.status === 'completed'
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
              {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved') && (
                <div className="space-y-4">
                  {selectedRequest.status === 'pending' && (
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
                  )}

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
                    {selectedRequest.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedRequest.id)}
                        className="inline-flex items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
                      >
                        Approve
                      </button>
                    )}
                    {selectedRequest.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleComplete(selectedRequest.id)}
                        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                      >
                        Complete
                      </button>
                    )}
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
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${request.status === 'approved' || request.status === 'completed'
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

      {/* Feedback Modal */}
      {feedbackModal.open && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">Schedule Request</h3>
              <button
                type="button"
                onClick={() => setFeedbackModal({ open: false, message: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-700">{feedbackModal.message}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setFeedbackModal({ open: false, message: '' })}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donor Details Modal */}
      {isDonorDetailsOpen && selectedDonorDetails && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Donor Details
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsDonorDetailsOpen(false)
                  setSelectedDonorDetails(null)
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Basic Info */}
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Basic Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-500">Name</p>
                    <p className="font-medium text-slate-900">
                      {selectedDonorDetails.donor.fullName || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Blood Type</p>
                    <div className="mt-0.5">
                      <BloodTypeBadge type={selectedDonorDetails.donor.bloodType} className="text-sm" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Contact</p>
                    <p className="font-medium text-slate-900">
                      {selectedDonorDetails.donor.phone || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Last Donation</p>
                    <p className="font-medium text-slate-900">
                      {selectedDonorDetails.donor.lastDonationDate
                        ? new Date(selectedDonorDetails.donor.lastDonationDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Total Donations</p>
                    <p className="font-medium text-slate-900">
                      {selectedDonorDetails.totalDonations || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Component Status */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Component Status
                </h4>
                <div className="space-y-3">
                  {['whole_blood', 'platelets', 'plasma'].map((key) => {
                    const info = selectedDonorDetails.stats?.[key]
                    if (!info) return null
                    const label =
                      key === 'whole_blood'
                        ? 'Whole Blood'
                        : key === 'platelets'
                        ? 'Platelets'
                        : 'Plasma'
                    const eligibleBadgeClasses = info.isEligible
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-amber-50 text-amber-700 ring-amber-200'
                    return (
                      <div
                        key={key}
                        className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {label}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            Completed donations: <span className="font-semibold">{info.completedCount}</span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            Last donation:{' '}
                            {info.lastCompletedAt
                              ? new Date(info.lastCompletedAt).toLocaleDateString()
                              : '—'}
                          </p>
                          {!info.isEligible && info.nextEligibleAt && (
                            <p className="mt-0.5 text-[11px] text-amber-700">
                              Next eligible on{' '}
                              {new Date(info.nextEligibleAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${eligibleBadgeClasses}`}
                        >
                          {info.isEligible ? 'Eligible' : 'In cooldown'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed right-4 top-4 z-60 transition-all duration-300 ease-in-out">
          <div
            className={`flex min-w-[300px] max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {notification.type === 'destructive' ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
              type="button"
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
    </AdminLayout>
  )
}

export default AdminDonation
