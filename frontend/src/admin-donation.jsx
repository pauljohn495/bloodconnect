import { useCallback, useEffect, useRef, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'
import DonorBroadcastModal from './DonorBroadcastModal.jsx'

function parseDonorPendingProfile(donor) {
  if (!donor?.pending_profile_json) return null
  try {
    return JSON.parse(donor.pending_profile_json)
  } catch {
    return null
  }
}

function todayYmdLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Default expiry aligned with backend shelf-life hints (editable in the date picker). */
function defaultExpirationYmd(componentType) {
  const v = (componentType || 'whole_blood').toString().toLowerCase()
  const days = v === 'platelets' ? 5 : v === 'plasma' ? 365 : 42
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function maxExpirationYmdFromToday() {
  const d = new Date()
  d.setDate(d.getDate() + 400)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function AdminDonation() {
  const WHOLE_BLOOD_COOLDOWN_DAYS = 90
  const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  const [activeSection, setActiveSection] = useState('donors') // 'donors' | 'organizations' | 'rc143'
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
  const [recordDonationSubmitting, setRecordDonationSubmitting] = useState(false)
  const [isWalkInDonationModalOpen, setIsWalkInDonationModalOpen] = useState(false)
  const [walkInDonor, setWalkInDonor] = useState(null)
  const [walkInUnits, setWalkInUnits] = useState('1')
  const [walkInExpiration, setWalkInExpiration] = useState('')
  const [walkInComponent, setWalkInComponent] = useState('whole_blood')
  const [walkInSubmitting, setWalkInSubmitting] = useState(false)
  const [isScheduleHistoryModalOpen, setIsScheduleHistoryModalOpen] = useState(false)
  const [scheduleHistory, setScheduleHistory] = useState([])
  const [isScheduleHistoryLoading, setIsScheduleHistoryLoading] = useState(false)
  const [previousModalOpen, setPreviousModalOpen] = useState(null) // Track which modal was open before details
  const [feedbackModal, setFeedbackModal] = useState({ open: false, message: '' })
  const [isDonorDetailsOpen, setIsDonorDetailsOpen] = useState(false)
  const [selectedDonorDetails, setSelectedDonorDetails] = useState(null)
  const [donorDetailAvatarFailed, setDonorDetailAvatarFailed] = useState(false)
  const [donorSearch, setDonorSearch] = useState('')
  const [donorBloodTypeFilter, setDonorBloodTypeFilter] = useState('all')
  const [donorEligibilityFilter, setDonorEligibilityFilter] = useState('all')
  const [organizationSearch, setOrganizationSearch] = useState('')
  const [notification, setNotification] = useState(null)
  const [recallSmsLoadingId, setRecallSmsLoadingId] = useState(null)
  const [isRecallConfirmModalOpen, setIsRecallConfirmModalOpen] = useState(false)
  const [donorToRecall, setDonorToRecall] = useState(null)
  const [openMenuDonorId, setOpenMenuDonorId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRefs = useRef({})
  const [profileReviewLoadingId, setProfileReviewLoadingId] = useState(null)
  const [profileDiffDonor, setProfileDiffDonor] = useState(null)
  const [isEditDonorModalOpen, setIsEditDonorModalOpen] = useState(false)
  const [editingDonor, setEditingDonor] = useState(null)
  const [editDonorName, setEditDonorName] = useState('')
  const [editBloodType, setEditBloodType] = useState('')
  const [editContactDonor, setEditContactDonor] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [isDeleteDonorModalOpen, setIsDeleteDonorModalOpen] = useState(false)
  const [donorToDelete, setDonorToDelete] = useState(null)
  const [isDeletingDonor, setIsDeletingDonor] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [isOrganizationsLoading, setIsOrganizationsLoading] = useState(false)
  const [organizationsError, setOrganizationsError] = useState('')
  const [isAddOrganizationModalOpen, setIsAddOrganizationModalOpen] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [organizationContactNumber, setOrganizationContactNumber] = useState('')
  const [organizationEmailAddress, setOrganizationEmailAddress] = useState('')
  const [organizationAddress, setOrganizationAddress] = useState('')
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false)

  const [isOrgDonationModalOpen, setIsOrgDonationModalOpen] = useState(false)
  const [orgDonationOrganizationId, setOrgDonationOrganizationId] = useState('')
  const [orgDonationDate, setOrgDonationDate] = useState('')
  const [orgDonationItems, setOrgDonationItems] = useState([
    { componentType: 'whole_blood', bloodType: '', units: '', expirationDate: '' },
  ])
  const [isSavingOrgDonation, setIsSavingOrgDonation] = useState(false)

  const [donorBroadcastOpen, setDonorBroadcastOpen] = useState(false)
  const [isDonationRankingModalOpen, setIsDonationRankingModalOpen] = useState(false)
  const [rankingTab, setRankingTab] = useState('organizations') // 'organizations' | 'donors'
  const [orgRanking, setOrgRanking] = useState([])
  const [donorRanking, setDonorRanking] = useState([])
  const [isRankingLoading, setIsRankingLoading] = useState(false)
  const [rankingError, setRankingError] = useState('')

  const RC143_VOLUNTEERS_KEY = 'bloodconnect_rc143_volunteers'
  const RC143_REQUESTS_KEY = 'bloodconnect_rc143_activity_requests'

  const [rc143Volunteers, setRc143Volunteers] = useState(() => {
    try {
      const raw = localStorage.getItem(RC143_VOLUNTEERS_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (Array.isArray(p)) return p
      }
    } catch {
      /* ignore */
    }
    return []
  })
  const [isRc143VolunteerModalOpen, setIsRc143VolunteerModalOpen] = useState(false)
  const [editingRc143VolunteerId, setEditingRc143VolunteerId] = useState(null)
  const [isDeleteRc143VolunteerModalOpen, setIsDeleteRc143VolunteerModalOpen] = useState(false)
  const [rc143VolunteerToDelete, setRc143VolunteerToDelete] = useState(null)
  const [isRc143HistoryModalOpen, setIsRc143HistoryModalOpen] = useState(false)
  const [rc143Requests, setRc143Requests] = useState(() => {
    try {
      const raw = localStorage.getItem(RC143_REQUESTS_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (Array.isArray(p)) return p
      }
    } catch {
      /* ignore */
    }
    return []
  })
  const [rc143VolunteerUserId, setRc143VolunteerUserId] = useState('')
  const [rc143VolFullName, setRc143VolFullName] = useState('')
  const [rc143VolOrganization, setRc143VolOrganization] = useState('')
  const [rc143VolOccupation, setRc143VolOccupation] = useState('')
  const [rc143VolContact, setRc143VolContact] = useState('')
  const [rc143VolAddress, setRc143VolAddress] = useState('')
  const [rc143VolContactNumber, setRc143VolContactNumber] = useState('')
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

  const donorHasPendingProfile = (donor) => Boolean(donor.pending_profile_json)

  const handleApproveDonorProfile = async (donorId) => {
    try {
      setProfileReviewLoadingId(donorId)
      await apiRequest(`/api/admin/donors/${donorId}/profile-update/approve`, { method: 'POST' })
      showNotification('Profile update approved.', 'primary')
      setProfileDiffDonor((prev) => (prev && prev.id === donorId ? null : prev))
      await loadDonors()
    } catch (err) {
      alert(err.message || 'Failed to approve profile update')
    } finally {
      setProfileReviewLoadingId(null)
    }
  }

  const handleRejectDonorProfile = async (donorId) => {
    if (!window.confirm('Reject this donor’s profile changes? Their current profile will stay as-is.')) {
      return
    }
    try {
      setProfileReviewLoadingId(donorId)
      await apiRequest(`/api/admin/donors/${donorId}/profile-update/reject`, { method: 'POST' })
      showNotification('Profile update rejected.', 'primary')
      setProfileDiffDonor((prev) => (prev && prev.id === donorId ? null : prev))
      await loadDonors()
    } catch (err) {
      alert(err.message || 'Failed to reject profile update')
    } finally {
      setProfileReviewLoadingId(null)
    }
  }

  const loadOrganizations = async () => {
    try {
      setIsOrganizationsLoading(true)
      setOrganizationsError('')
      const data = await apiRequest('/api/admin/organizations')
      setOrganizations(data || [])
    } catch (err) {
      setOrganizationsError(err.message || 'Failed to load organizations')
    } finally {
      setIsOrganizationsLoading(false)
    }
  }

  useEffect(() => {
    loadDonors()
  }, [])

  useEffect(() => {
    if (activeSection === 'organizations') {
      loadOrganizations()
    }
  }, [activeSection])

  useEffect(() => {
    try {
      localStorage.setItem(RC143_VOLUNTEERS_KEY, JSON.stringify(rc143Volunteers))
    } catch {
      /* quota / private mode */
    }
  }, [rc143Volunteers])

  useEffect(() => {
    try {
      localStorage.setItem(RC143_REQUESTS_KEY, JSON.stringify(rc143Requests))
    } catch {
      /* quota / private mode */
    }
  }, [rc143Requests])

  useEffect(() => {
    const syncRc143RequestsFromStorage = () => {
      try {
        const raw = localStorage.getItem(RC143_REQUESTS_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        setRc143Requests(Array.isArray(parsed) ? parsed : [])
      } catch {
        setRc143Requests([])
      }
    }

    // Refresh whenever admin opens/switches to RC143 and when storage changes.
    if (activeSection === 'rc143') {
      syncRc143RequestsFromStorage()
    }
    window.addEventListener('storage', syncRc143RequestsFromStorage)
    window.addEventListener('focus', syncRc143RequestsFromStorage)
    return () => {
      window.removeEventListener('storage', syncRc143RequestsFromStorage)
      window.removeEventListener('focus', syncRc143RequestsFromStorage)
    }
  }, [activeSection])

  useEffect(() => {
    const handleScroll = () => {
      if (openMenuDonorId) setOpenMenuDonorId(null)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openMenuDonorId])

  useEffect(() => {
    if (selectedDonorDetails) setDonorDetailAvatarFailed(false)
  }, [selectedDonorDetails])

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

  const donorDisplayName = (donor) =>
    (
      donor?.full_name ||
      donor?.fullName ||
      donor?.donor_name ||
      donor?.donorName ||
      donor?.username ||
      ''
    )
      .toString()
      .trim()

  const rc143AssignableUsers = donors
    .filter((donor) => donor?.id != null)
    .map((donor) => {
      const roleRaw = (donor?.role || donor?.user_role || 'donor').toString().toLowerCase()
      const roleLabel = roleRaw === 'recipient' ? 'Recipient' : roleRaw === 'donor' ? 'Donor' : 'User'
      return {
        id: String(donor.id),
        fullName: donorDisplayName(donor) || `User #${donor.id}`,
        role: roleRaw,
        roleLabel,
        organization: (donor?.organization || donor?.organization_name || '').toString().trim(),
        occupation: (donor?.occupation || donor?.profession || '').toString().trim(),
        contact:
          (donor?.email || donor?.phone || donor?.contact_phone || donor?.contactPhone || '')
            .toString()
            .trim(),
        address: (donor?.address || donor?.full_address || '').toString().trim(),
        contactNumber:
          (donor?.phone || donor?.contact_phone || donor?.contactPhone || '')
            .toString()
            .trim(),
      }
    })

  const fillRc143VolunteerFromUser = useCallback(
    (userId) => {
      const selected = rc143AssignableUsers.find((u) => String(u.id) === String(userId))
      if (!selected) return
      setRc143VolunteerUserId(String(selected.id))
      setRc143VolFullName(selected.fullName)
      setRc143VolOrganization(selected.organization)
      setRc143VolOccupation(selected.occupation)
      setRc143VolContact(selected.contact)
      setRc143VolAddress(selected.address)
      setRc143VolContactNumber(selected.contactNumber)
    },
    [rc143AssignableUsers],
  )

  const getWholeBloodEligibility = (donor) => {
    const raw = donor?.last_donation_date || donor?.lastDonationDate
    if (!raw) return true
    const lastDonation = new Date(raw)
    if (Number.isNaN(lastDonation.getTime())) return true

    const nextEligibleDate = new Date(lastDonation)
    nextEligibleDate.setDate(nextEligibleDate.getDate() + WHOLE_BLOOD_COOLDOWN_DAYS)
    return nextEligibleDate <= new Date()
  }

  const filteredDonors = donors.filter((donor) => {
    const q = donorSearch.trim().toLowerCase()
    const matchesSearch = !q || donorNameForSearch(donor).includes(q)

    const donorBloodType = (donor.blood_type || donor.bloodType || '').toUpperCase()
    const matchesBloodType = donorBloodTypeFilter === 'all' || donorBloodType === donorBloodTypeFilter

    const isWholeBloodEligible = getWholeBloodEligibility(donor)
    const matchesEligibility =
      donorEligibilityFilter === 'all' ||
      (donorEligibilityFilter === 'available' && isWholeBloodEligible) ||
      (donorEligibilityFilter === 'not_available' && !isWholeBloodEligible)

    return matchesSearch && matchesBloodType && matchesEligibility
  })

  const filteredOrganizations = organizations.filter((org) => {
    const q = organizationSearch.trim().toLowerCase()
    if (!q) return true
    const name = (org.name || '').toString().toLowerCase()
    const contact = (org.contact_number || '').toString().toLowerCase()
    const email = (org.email || '').toString().toLowerCase()
    const address = (org.address || '').toString().toLowerCase()
    return (
      name.includes(q) ||
      contact.includes(q) ||
      email.includes(q) ||
      address.includes(q)
    )
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

  const handleOpenAddOrganizationModal = () => {
    setIsAddOrganizationModalOpen(true)
    setOrganizationName('')
    setOrganizationContactNumber('')
    setOrganizationEmailAddress('')
    setOrganizationAddress('')
    setIsCreatingOrganization(false)
  }

  const handleOpenOrgDonationModal = () => {
    setIsOrgDonationModalOpen(true)
    setIsSavingOrgDonation(false)

    const todayIso = new Date().toISOString().split('T')[0]
    setOrgDonationDate(todayIso)
    setOrgDonationItems([{ componentType: 'whole_blood', bloodType: '', units: '', expirationDate: '' }])

    // Default to first org if available (convenience)
    if (organizations && organizations.length > 0) {
      setOrgDonationOrganizationId(String(organizations[0].id))
    } else {
      setOrgDonationOrganizationId('')
      // Ensure we have the latest organizations list
      loadOrganizations()
    }
  }

  const handleCloseOrgDonationModal = () => {
    setIsOrgDonationModalOpen(false)
    setOrgDonationOrganizationId('')
    setOrgDonationDate('')
    setOrgDonationItems([{ componentType: 'whole_blood', bloodType: '', units: '', expirationDate: '' }])
    setIsSavingOrgDonation(false)
  }

  const updateOrgDonationItem = (index, patch) => {
    setOrgDonationItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeOrgDonationItem = (index) => {
    setOrgDonationItems((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const addOrgDonationItem = () => {
    setOrgDonationItems((prev) => [
      ...prev,
      { componentType: 'whole_blood', bloodType: '', units: '', expirationDate: '' },
    ])
  }

  const handleSubmitOrgDonation = async (e) => {
    e.preventDefault()
    try {
      setIsSavingOrgDonation(true)
      await apiRequest('/api/admin/organization-donations', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: Number(orgDonationOrganizationId),
          donationDate: orgDonationDate,
          items: orgDonationItems.map((row) => ({
            componentType: row.componentType,
            bloodType: row.bloodType,
            units: Number(row.units),
            expirationDate: row.expirationDate,
          })),
        }),
      })
      handleCloseOrgDonationModal()
      showNotification('Donation entry saved and inventory updated.', 'primary')
    } catch (err) {
      showNotification(err.message || 'Failed to save donation entry', 'destructive')
      setIsSavingOrgDonation(false)
    }
  }

  const handleOpenDonationRankingModal = async () => {
    setIsDonationRankingModalOpen(true)
    setRankingError('')
    setIsRankingLoading(true)
    try {
      const [orgs, donors] = await Promise.all([
        apiRequest('/api/admin/donation-rankings/organizations?limit=50'),
        apiRequest('/api/admin/donation-rankings/donors?limit=50'),
      ])
      setOrgRanking(orgs || [])
      setDonorRanking(donors || [])
    } catch (err) {
      setRankingError(err.message || 'Failed to load donation rankings')
    } finally {
      setIsRankingLoading(false)
    }
  }

  const handleCloseDonationRankingModal = () => {
    setIsDonationRankingModalOpen(false)
    setRankingError('')
    setIsRankingLoading(false)
  }

  const handleCloseAddOrganizationModal = () => {
    setIsAddOrganizationModalOpen(false)
    setOrganizationName('')
    setOrganizationContactNumber('')
    setOrganizationEmailAddress('')
    setOrganizationAddress('')
    setIsCreatingOrganization(false)
  }

  const handleCreateOrganization = async (e) => {
    e.preventDefault()
    try {
      setIsCreatingOrganization(true)
      await apiRequest('/api/admin/organizations', {
        method: 'POST',
        body: JSON.stringify({
          organizationName,
          contactNumber: organizationContactNumber,
          emailAddress: organizationEmailAddress,
          address: organizationAddress,
        }),
      })
      await loadOrganizations()
      handleCloseAddOrganizationModal()
      showNotification('Organization added successfully!', 'primary')
    } catch (err) {
      showNotification(err.message || 'Failed to add organization', 'destructive')
      setIsCreatingOrganization(false)
    }
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

  const handleRecordDonationComplete = async (requestId) => {
    const requestedBloodType = (selectedRequest?.requested_blood_type || '').toString().trim()
    const isBloodRequest = requestedBloodType.length > 0

    let body
    if (isBloodRequest) {
      body = {}
    } else {
      const u = 1
      const exp = defaultExpirationYmd(selectedRequest?.component_type)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
        showNotification('Select the unit expiration date', 'destructive')
        return
      }
      const today = todayYmdLocal()
      if (exp < today) {
        showNotification('Expiration date cannot be before today', 'destructive')
        return
      }
      const maxY = maxExpirationYmdFromToday()
      if (exp > maxY) {
        showNotification('Expiration date is too far in the future', 'destructive')
        return
      }
      body = { unitsDonated: u, expirationDate: exp }
    }

    try {
      setRecordDonationSubmitting(true)
      const result = await apiRequest(`/api/admin/schedule-requests/${requestId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await loadScheduleRequests()
      if (isScheduleHistoryModalOpen) {
        await loadScheduleHistory()
      }
      setIsDetailsModalOpen(false)
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(null)
      }

      if (result?.mode === 'blood_request' || isBloodRequest) {
        setFeedbackModal({
          open: true,
          message: 'Blood request marked complete. No donation or inventory was recorded.',
        })
      } else {
        const u = parseInt(String(body.unitsDonated ?? ''), 10) || 1
        const extra =
          result?.expirationDate && result?.inventoryId
            ? ` Inventory batch #${result.inventoryId} expires ${result.expirationDate}.`
            : ''
        const recordedAt =
          result?.actualDonationAt && !Number.isNaN(new Date(result.actualDonationAt).getTime())
            ? ` Recorded at ${new Date(result.actualDonationAt).toLocaleString()}.`
            : ''
        setFeedbackModal({
          open: true,
          message: `Donation recorded (${u} unit${u === 1 ? '' : 's'}). Central inventory updated.${recordedAt}${extra}`,
        })
      }
    } catch (err) {
      console.error('Failed to record donation', err)
      setFeedbackModal({
        open: true,
        message: err.message || 'Failed to record donation',
      })
    } finally {
      setRecordDonationSubmitting(false)
    }
  }

  const openWalkInDonationModal = (donor) => {
    setWalkInDonor(donor)
    setWalkInUnits('1')
    setWalkInComponent('whole_blood')
    setWalkInExpiration(defaultExpirationYmd('whole_blood'))
    setIsWalkInDonationModalOpen(true)
    setOpenMenuDonorId(null)
  }

  const closeWalkInDonationModal = () => {
    setIsWalkInDonationModalOpen(false)
    setWalkInDonor(null)
  }

  const handleWalkInComponentChange = (e) => {
    const v = e.target.value
    setWalkInComponent(v)
    setWalkInExpiration(defaultExpirationYmd(v))
  }

  const handleSubmitWalkInDonation = async (e) => {
    e.preventDefault()
    if (!walkInDonor?.id) return
    const u = parseInt(walkInUnits, 10)
    if (Number.isNaN(u) || u < 1 || u > 50) {
      showNotification('Units must be between 1 and 50', 'destructive')
      return
    }
    const exp = (walkInExpiration || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      showNotification('Select the unit expiration date', 'destructive')
      return
    }
    const today = todayYmdLocal()
    if (exp < today) {
      showNotification('Expiration date cannot be before today', 'destructive')
      return
    }
    if (exp > maxExpirationYmdFromToday()) {
      showNotification('Expiration date is too far in the future', 'destructive')
      return
    }
    try {
      setWalkInSubmitting(true)
      await apiRequest(`/api/admin/donors/${walkInDonor.id}/record-donation`, {
        method: 'POST',
        body: JSON.stringify({
          unitsDonated: u,
          expirationDate: exp,
          componentType: walkInComponent,
        }),
      })
      await loadDonors()
      closeWalkInDonationModal()
      showNotification('Walk-in donation recorded and inventory updated.', 'primary')
    } catch (err) {
      console.error('Walk-in donation failed', err)
      showNotification(err.message || 'Failed to record donation', 'destructive')
    } finally {
      setWalkInSubmitting(false)
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

  const handleOpenRecallConfirmModal = (donor) => {
    const phone = donor.phone || donor.contact_phone || donor.contactPhone
    if (!phone || !String(phone).trim()) {
      showNotification('This donor has no phone number for SMS.', 'destructive')
      return
    }
    setDonorToRecall(donor)
    setIsRecallConfirmModalOpen(true)
  }

  const handleCloseRecallConfirmModal = () => {
    if (recallSmsLoadingId) return
    setIsRecallConfirmModalOpen(false)
    setDonorToRecall(null)
  }

  const handleConfirmRecallSms = async () => {
    if (!donorToRecall) return
    try {
      setRecallSmsLoadingId(donorToRecall.id)
      await apiRequest(`/api/admin/donors/${donorToRecall.id}/recall-sms`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      showNotification('Recall SMS sent.', 'primary')
      setIsRecallConfirmModalOpen(false)
      setDonorToRecall(null)
    } catch (err) {
      showNotification(err.message || 'Failed to send recall SMS', 'destructive')
    } finally {
      setRecallSmsLoadingId(null)
    }
  }

  const openRc143VolunteerModal = () => {
    if (rc143AssignableUsers.length === 0) {
      showNotification('No donor/recipient users available to assign.', 'destructive')
      return
    }
    setEditingRc143VolunteerId(null)
    const firstUserId = rc143AssignableUsers[0]?.id ? String(rc143AssignableUsers[0].id) : ''
    setRc143VolunteerUserId(firstUserId)
    setRc143VolFullName('')
    setRc143VolOrganization('')
    setRc143VolOccupation('')
    setRc143VolContact('')
    setRc143VolAddress('')
    setRc143VolContactNumber('')
    if (firstUserId) fillRc143VolunteerFromUser(firstUserId)
    setIsRc143VolunteerModalOpen(true)
  }

  const closeRc143VolunteerModal = () => {
    setIsRc143VolunteerModalOpen(false)
    setEditingRc143VolunteerId(null)
  }

  const openEditRc143VolunteerModal = (volunteer) => {
    if (rc143AssignableUsers.length === 0) {
      showNotification('No donor/recipient users available to assign.', 'destructive')
      return
    }
    setEditingRc143VolunteerId(volunteer.id)
    const preferredId = volunteer.sourceUserId ? String(volunteer.sourceUserId) : String(rc143AssignableUsers[0].id)
    setRc143VolunteerUserId(preferredId)
    fillRc143VolunteerFromUser(preferredId)
    setRc143VolOrganization((volunteer.organization || '').toString())
    setRc143VolOccupation((volunteer.occupation || '').toString())
    setRc143VolContact((volunteer.contact || '').toString())
    setRc143VolAddress((volunteer.address || '').toString())
    setRc143VolContactNumber((volunteer.contactNumber || '').toString())
    setIsRc143VolunteerModalOpen(true)
  }

  const handleOpenDeleteRc143VolunteerModal = (volunteerId) => {
    const target = rc143Volunteers.find((v) => String(v.id) === String(volunteerId))
    if (!target) return
    setRc143VolunteerToDelete(target)
    setIsDeleteRc143VolunteerModalOpen(true)
  }

  const handleCloseDeleteRc143VolunteerModal = () => {
    setIsDeleteRc143VolunteerModalOpen(false)
    setRc143VolunteerToDelete(null)
  }

  const handleConfirmDeleteRc143Volunteer = () => {
    if (!rc143VolunteerToDelete) return
    const volunteerId = String(rc143VolunteerToDelete.id)
    setRc143Volunteers((prev) => prev.filter((v) => String(v.id) !== volunteerId))
    setRc143Requests((prev) => prev.filter((r) => String(r.volunteerId) !== volunteerId))
    handleCloseDeleteRc143VolunteerModal()
    showNotification('Volunteer deleted.', 'primary')
  }

  const handleUpdateRc143RequestStatus = (requestId, nextStatus) => {
    setRc143Requests((prev) =>
      prev.map((r) =>
        String(r.id) === String(requestId)
          ? { ...r, status: nextStatus, reviewedAt: new Date().toISOString() }
          : r,
      ),
    )
    showNotification(`Request marked as ${nextStatus}.`, 'primary')
  }

  const handleSubmitRc143Volunteer = (e) => {
    e.preventDefault()
    if (!rc143VolunteerUserId) {
      showNotification('Please select an existing donor/recipient user.', 'destructive')
      return
    }
    const selectedUser = rc143AssignableUsers.find((u) => String(u.id) === String(rc143VolunteerUserId))
    if (!selectedUser) {
      showNotification('Selected user no longer exists. Refresh and try again.', 'destructive')
      return
    }
    const fullName = rc143VolFullName.trim()
    if (!fullName) {
      showNotification('Please enter full name.', 'destructive')
      return
    }
    const baseVolunteer = {
      fullName,
      sourceUserId: selectedUser.id,
      sourceUserRole: selectedUser.role,
      organization: rc143VolOrganization.trim(),
      occupation: rc143VolOccupation.trim(),
      contact: rc143VolContact.trim(),
      address: rc143VolAddress.trim(),
      contactNumber: rc143VolContactNumber.trim(),
    }
    if (editingRc143VolunteerId) {
      setRc143Volunteers((prev) =>
        prev.map((v) =>
          String(v.id) === String(editingRc143VolunteerId)
            ? { ...v, ...baseVolunteer, updatedAt: new Date().toISOString() }
            : v,
        ),
      )
      closeRc143VolunteerModal()
      showNotification('Volunteer updated.', 'primary')
      return
    }
    const rid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setRc143Volunteers((prev) => [
      {
        id: rid,
        ...baseVolunteer,
        registeredAt: new Date().toISOString(),
      },
      ...prev,
    ])
    closeRc143VolunteerModal()
    showNotification('Volunteer registered.', 'primary')
  }

  const openRc143HistoryModal = () => {
    setIsRc143HistoryModalOpen(true)
  }

  const closeRc143HistoryModal = () => {
    setIsRc143HistoryModalOpen(false)
  }

  const rc143RequestHistory = rc143Requests
    .filter((r) => r.status === 'approved' || r.status === 'rejected')
    .sort((a, b) => {
      const aTs = new Date(a.reviewedAt || a.requestedAt || 0).getTime()
      const bTs = new Date(b.reviewedAt || b.requestedAt || 0).getTime()
      return bTs - aTs
    })
  const rc143ActiveRequests = rc143Requests
    .filter((r) => String(r.status || 'pending').toLowerCase() === 'pending')
    .sort((a, b) => {
      const aTs = new Date(a.requestedAt || 0).getTime()
      const bTs = new Date(b.requestedAt || 0).getTime()
      return bTs - aTs
    })

  return (
    <AdminLayout
      pageTitle={
        activeSection === 'organizations'
          ? 'Organizations'
          : activeSection === 'rc143'
            ? 'RC143'
            : 'Donors'
      }
      pageDescription={
        activeSection === 'organizations'
          ? 'View and manage registered organizations.'
          : activeSection === 'rc143'
            ? 'Register volunteers and review their activity requests.'
            : 'View and manage registered blood donors.'
      }
    >
      <section className="mt-2">
        <div className="mb-3 flex items-center justify-start">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100/95 p-1 ring-1 ring-slate-200/70"
            role="tablist"
            aria-label="Donations section"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'donors'}
              onClick={() => setActiveSection('donors')}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                activeSection === 'donors'
                  ? 'border border-slate-200/90 bg-white text-red-900 shadow-sm shadow-slate-200/80'
                  : 'border border-transparent bg-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              Donors / Recipients
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'organizations'}
              onClick={() => setActiveSection('organizations')}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                activeSection === 'organizations'
                  ? 'border border-slate-200/90 bg-white text-red-900 shadow-sm shadow-slate-200/80'
                  : 'border border-transparent bg-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              Organizations
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'rc143'}
              onClick={() => setActiveSection('rc143')}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                activeSection === 'rc143'
                  ? 'border border-slate-200/90 bg-white text-red-900 shadow-sm shadow-slate-200/80'
                  : 'border border-transparent bg-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              RC143
            </button>
          </div>
        </div>
        {activeSection === 'rc143' ? (
          <div className={adminPanel.emerald.outer}>
            <div className={adminPanel.emerald.header}>
              <div>
                <h2 className={adminPanel.emerald.title}>RC143 — Volunteers</h2>
                <p className={adminPanel.emerald.subtitle}>
                  Register volunteers and review their requested blood donation activities.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openRc143VolunteerModal}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:min-h-0"
                >
                  Register New Volunteer
                </button>
                <button
                  type="button"
                  onClick={openRc143HistoryModal}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:min-h-0"
                >
                  History
                </button>
              </div>
            </div>

            <div className="space-y-8 px-4 py-6 sm:px-5">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  Volunteers
                </h3>
                <div className={adminPanel.emerald.tableScroll}>
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className={adminPanel.emerald.thead}>
                      <tr>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Full name
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Organization
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Occupation
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Contact
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Address
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Contact number
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={adminPanel.emerald.tbody}>
                      {rc143Volunteers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                            No volunteers registered yet. Use &quot;Register New Volunteer&quot; to add one.
                          </td>
                        </tr>
                      ) : (
                        rc143Volunteers.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">{v.fullName}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{v.organization || '—'}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{v.occupation || '—'}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{v.contact || '—'}</td>
                            <td className="max-w-xs px-4 py-2 text-sm text-slate-700">{v.address || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">{v.contactNumber || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditRc143VolunteerModal(v)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteRc143VolunteerModal(v.id)}
                                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  Volunteer activity requests
                </h3>
                <div className={adminPanel.emerald.tableScroll}>
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className={adminPanel.emerald.thead}>
                      <tr>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Volunteer
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Title
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Details
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Location
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Status
                        </th>
                        <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                          Review
                        </th>
                      </tr>
                    </thead>
                    <tbody className={adminPanel.emerald.tbody}>
                      {rc143ActiveRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                            No pending activity requests.
                          </td>
                        </tr>
                      ) : (
                        rc143ActiveRequests.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                              {r.volunteerName || '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                              {r.title || '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-700">{r.details || '—'}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{r.location || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                                  r.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                                    : r.status === 'rejected'
                                      ? 'bg-red-100 text-red-800 ring-red-200'
                                      : 'bg-amber-100 text-amber-800 ring-amber-200'
                                }`}
                              >
                                {String(r.status || 'pending').toUpperCase()}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRc143RequestStatus(r.id, 'approved')}
                                  disabled={r.status === 'approved'}
                                  className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRc143RequestStatus(r.id, 'rejected')}
                                  disabled={r.status === 'rejected'}
                                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        ) : (
        <div className={adminPanel.emerald.outer}>
          <div className={adminPanel.emerald.header}>
            <div>
              <h2 className={adminPanel.emerald.title}>
                {activeSection === 'organizations' ? 'Organizations' : 'List of Donors'}
              </h2>
              <p className={adminPanel.emerald.subtitle}>
                {activeSection === 'organizations'
                  ? 'Overview of all registered organizations'
                  : 'Overview of all registered donors'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <input
                  value={activeSection === 'organizations' ? organizationSearch : donorSearch}
                  onChange={(e) =>
                    activeSection === 'organizations'
                      ? setOrganizationSearch(e.target.value)
                      : setDonorSearch(e.target.value)
                  }
                  placeholder={
                    activeSection === 'organizations'
                      ? 'Search name, contact, email...'
                      : 'Search donor name...'
                  }
                  className="w-56 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              {activeSection === 'donors' && (
                <>
                  <select
                    value={donorBloodTypeFilter}
                    onChange={(e) => setDonorBloodTypeFilter(e.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="all">All Blood Types</option>
                    {BLOOD_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    value={donorEligibilityFilter}
                    onChange={(e) => setDonorEligibilityFilter(e.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="all">All</option>
                    <option value="available">Available</option>
                    <option value="not_available">Not Available</option>
                  </select>
                </>
              )}
              {activeSection === 'donors' ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenDonationRankingModal}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Donation Ranking
                  </button>
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
                    onClick={() => setDonorBroadcastOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 shadow-sm transition hover:bg-rose-100"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Send Notification
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenModal}
                    className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    Add Donor
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleOpenDonationRankingModal}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Donation Ranking
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenOrgDonationModal}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Donation Entry
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddOrganizationModal}
                    className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    Add Organization
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={adminPanel.emerald.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className={adminPanel.emerald.thead}>
                <tr>
                  {activeSection === 'donors' ? (
                    <>
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
                        Eligibility
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                        Status
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                        Profile update
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-center text-[13px] ${adminPanel.emerald.th}`}>
                        Recall
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-right text-[13px] ${adminPanel.emerald.th}`}>
                        Actions
                      </th>
                    </>
                  ) : (
                    <>
                      <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                        Organization Name
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                        Contact
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                        Email
                      </th>
                      <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.emerald.th}`}>
                        Address / Location
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className={adminPanel.emerald.tbody}>
                {activeSection === 'donors' && isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={8}>
                      Loading donors...
                    </td>
                  </tr>
                )}

                {activeSection === 'donors' && !isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={8}>
                      {error}
                    </td>
                  </tr>
                )}

                {activeSection === 'donors' && !isLoading && !error && donors.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={8}>
                      No donors added yet.
                    </td>
                  </tr>
                )}

                {activeSection === 'donors' &&
                  !isLoading &&
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
                        {getWholeBloodEligibility(donor) ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                            Not Available
                          </span>
                        )}
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
                      <td className="px-4 py-2 align-top text-sm">
                        {donorHasPendingProfile(donor) ? (
                          <div className="flex max-w-[220px] flex-col gap-2">
                            <div>
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                Awaiting review
                              </span>
                              {donor.profile_update_requested_at && (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {new Date(donor.profile_update_requested_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={profileReviewLoadingId === donor.id}
                              onClick={() => setProfileDiffDonor(donor)}
                              className="w-fit rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
                            >
                              Review changes
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-center text-sm">
                        <button
                          type="button"
                          disabled={
                            recallSmsLoadingId === donor.id ||
                            !(donor.phone || donor.contact_phone || donor.contactPhone)
                          }
                          onClick={() => handleOpenRecallConfirmModal(donor)}
                          className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {recallSmsLoadingId === donor.id ? 'Sending…' : 'Recall'}
                        </button>
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

                {activeSection === 'organizations' && isOrganizationsLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                      Loading organizations...
                    </td>
                  </tr>
                )}

                {activeSection === 'organizations' && !isOrganizationsLoading && organizationsError && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={4}>
                      {organizationsError}
                    </td>
                  </tr>
                )}

                {activeSection === 'organizations' &&
                  !isOrganizationsLoading &&
                  !organizationsError &&
                  organizations.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>
                        No organizations added yet.
                      </td>
                    </tr>
                  )}

                {activeSection === 'organizations' &&
                  !isOrganizationsLoading &&
                  !organizationsError &&
                  organizations.length > 0 &&
                  filteredOrganizations.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>
                        No organizations match your search.
                      </td>
                    </tr>
                  )}

                {activeSection === 'organizations' &&
                  !isOrganizationsLoading &&
                  !organizationsError &&
                  filteredOrganizations.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        {org.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {org.contact_number || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {org.email || '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {org.address || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
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

      {isAddOrganizationModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Organization</h3>
              <button
                type="button"
                onClick={handleCloseAddOrganizationModal}
                className="text-slate-400 hover:text-slate-600"
                disabled={isCreatingOrganization}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateOrganization} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Organization Name</label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Contact Number</label>
                <input
                  type="text"
                  value={organizationContactNumber}
                  onChange={(e) => setOrganizationContactNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={organizationEmailAddress}
                  onChange={(e) => setOrganizationEmailAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Address / Location</label>
                <textarea
                  rows={3}
                  value={organizationAddress}
                  onChange={(e) => setOrganizationAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseAddOrganizationModal}
                  disabled={isCreatingOrganization}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrganization}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreatingOrganization ? 'Saving...' : 'Save Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRc143VolunteerModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-5 shadow-xl ring-1 ring-red-100/80"
            role="dialog"
            aria-labelledby="rc143-volunteer-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-red-100 pb-3">
              <div>
                <h3 id="rc143-volunteer-title" className="text-base font-semibold text-red-950">
                  {editingRc143VolunteerId ? 'Edit Volunteer' : 'Register New Volunteer'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">RC143 outreach — blood donation programs</p>
              </div>
              <button
                type="button"
                onClick={closeRc143VolunteerModal}
                className="shrink-0 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitRc143Volunteer} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Select existing user (donor/recipient)</label>
                <select
                  value={rc143VolunteerUserId}
                  onChange={(e) => fillRc143VolunteerFromUser(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  required
                >
                  <option value="" disabled>
                    Select user
                  </option>
                  {rc143AssignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.roleLabel})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Full name</label>
                <input
                  type="text"
                  value={rc143VolFullName}
                  onChange={(e) => setRc143VolFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Full legal name"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Organization</label>
                <input
                  type="text"
                  value={rc143VolOrganization}
                  onChange={(e) => setRc143VolOrganization(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Company, school, or chapter"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Occupation</label>
                <input
                  type="text"
                  value={rc143VolOccupation}
                  onChange={(e) => setRc143VolOccupation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Job title or role"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Contact</label>
                <input
                  type="text"
                  value={rc143VolContact}
                  onChange={(e) => setRc143VolContact(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Email or preferred contact"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Address</label>
                <textarea
                  rows={2}
                  value={rc143VolAddress}
                  onChange={(e) => setRc143VolAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Street, city, region"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Contact number</label>
                <input
                  type="tel"
                  value={rc143VolContactNumber}
                  onChange={(e) => setRc143VolContactNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Mobile or landline"
                  autoComplete="tel"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRc143VolunteerModal}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  {editingRc143VolunteerId ? 'Save changes' : 'Save volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOrgDonationModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Create Donation Entry</h3>
              <button
                type="button"
                onClick={handleCloseOrgDonationModal}
                className="text-slate-400 hover:text-slate-600"
                disabled={isSavingOrgDonation}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitOrgDonation} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Organization</label>
                  <select
                    value={orgDonationOrganizationId}
                    onChange={(e) => setOrgDonationOrganizationId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    required
                  >
                    <option value="" disabled>
                      Select organization...
                    </option>
                    {organizations.map((org) => (
                      <option key={org.id} value={String(org.id)}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  {organizations.length === 0 && (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      No organizations yet. Add an organization first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Donation Date</label>
                  <input
                    type="date"
                    value={orgDonationDate}
                    onChange={(e) => setOrgDonationDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">Blood Types & Units</p>
                  <button
                    type="button"
                    onClick={addOrgDonationItem}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Add blood type
                  </button>
                </div>

                <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                  {orgDonationItems.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-12"
                    >
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600">Component</label>
                        <select
                          value={row.componentType || 'whole_blood'}
                          onChange={(e) => updateOrgDonationItem(idx, { componentType: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          required
                        >
                          <option value="whole_blood">Whole Blood</option>
                          <option value="platelets">Platelets</option>
                          <option value="plasma">Plasma</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600">Blood Type</label>
                        <select
                          value={row.bloodType}
                          onChange={(e) => updateOrgDonationItem(idx, { bloodType: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          required
                        >
                          <option value="">Select...</option>
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

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600">Units</label>
                        <input
                          type="number"
                          min="1"
                          value={row.units}
                          onChange={(e) => updateOrgDonationItem(idx, { units: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          placeholder="0"
                          required
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600">Expiry Date</label>
                        <input
                          type="date"
                          value={row.expirationDate}
                          onChange={(e) => updateOrgDonationItem(idx, { expirationDate: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          required
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => removeOrgDonationItem(idx)}
                          className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={orgDonationItems.length <= 1}
                          aria-label="Remove blood type row"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleCloseOrgDonationModal}
                  disabled={isSavingOrgDonation}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOrgDonation || organizations.length === 0}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingOrgDonation ? 'Saving...' : 'Save Donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDonationRankingModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Donation Ranking</h3>
                <p className="mt-0.5 text-xs text-slate-500">Total units donated leaderboard.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseDonationRankingModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setRankingTab('organizations')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    rankingTab === 'organizations'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Organizations
                </button>
                <button
                  type="button"
                  onClick={() => setRankingTab('donors')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    rankingTab === 'donors'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Donors
                </button>
              </div>
            </div>

            <div className="px-5 pb-5 pt-4">
              {isRankingLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading rankings...</div>
              ) : rankingError ? (
                <div className="py-10 text-center text-sm text-red-600">{rankingError}</div>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50/60">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Rank
                        </th>
                        <th className="px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          {rankingTab === 'organizations' ? 'Organization' : 'Donor'}
                        </th>
                        {rankingTab === 'donors' && (
                          <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                            Blood Type
                          </th>
                        )}
                        <th className="whitespace-nowrap px-4 py-2 text-right text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                          Total Units
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(rankingTab === 'organizations' ? orgRanking : donorRanking).map((row, index) => (
                        <tr key={(row.organizationId || row.donorId || index) + '_' + index} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                            #{index + 1}
                          </td>
                          <td className="px-4 py-2 text-sm font-semibold text-slate-900">
                            {rankingTab === 'organizations' ? row.organizationName : row.donorName}
                          </td>
                          {rankingTab === 'donors' && (
                            <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                              <BloodTypeBadge type={row.bloodType} className="text-[13px]" />
                            </td>
                          )}
                          <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-semibold text-slate-900">
                            <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[13px] font-semibold text-red-700 ring-1 ring-red-100">
                              {row.totalUnitsDonated ?? 0}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(rankingTab === 'organizations' ? orgRanking : donorRanking).length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-10 text-center text-sm text-slate-500"
                            colSpan={rankingTab === 'donors' ? 4 : 3}
                          >
                            No ranking data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {openMenuDonorId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuDonorId(null)} />
          <div
            className="fixed z-50 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-slate-200 focus:outline-none"
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
                  if (selectedDonor) openWalkInDonationModal(selectedDonor)
                }}
              >
                Record walk-in donation
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

      {/* Walk-in donation (no schedule — e.g. admin-created donors) */}
      {isWalkInDonationModalOpen && walkInDonor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="walk-in-donation-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="walk-in-donation-title" className="text-base font-semibold text-slate-900">
                Record walk-in donation
              </h3>
              <button
                type="button"
                onClick={closeWalkInDonationModal}
                className="text-slate-400 hover:text-slate-600"
                disabled={walkInSubmitting}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              For donors without an online appointment (for example, profiles you added manually). This records the
              donation time when you save and updates central inventory—same as completing an approved schedule.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {walkInDonor.full_name ||
                walkInDonor.fullName ||
                walkInDonor.donor_name ||
                walkInDonor.donorName ||
                'Donor'}
              <span className="ml-2 inline-flex align-middle">
                <BloodTypeBadge type={walkInDonor.blood_type || walkInDonor.bloodType} className="text-xs" />
              </span>
            </p>
            <form onSubmit={handleSubmitWalkInDonation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="walk-in-component">
                  Component type
                </label>
                <select
                  id="walk-in-component"
                  value={walkInComponent}
                  onChange={handleWalkInComponentChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="whole_blood">Whole blood</option>
                  <option value="platelets">Platelets</option>
                  <option value="plasma">Plasma</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="min-h-11 text-xs font-medium leading-snug text-slate-700" htmlFor="walk-in-units">
                    Units donated
                  </label>
                  <input
                    id="walk-in-units"
                    type="number"
                    min={1}
                    max={50}
                    value={walkInUnits}
                    onChange={(e) => setWalkInUnits(e.target.value)}
                    className="box-border min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    className="min-h-11 text-xs font-medium leading-snug text-slate-700"
                    htmlFor="walk-in-expiration"
                  >
                    Unit expiration date (inventory)
                  </label>
                  <input
                    id="walk-in-expiration"
                    type="date"
                    value={walkInExpiration}
                    min={todayYmdLocal()}
                    max={maxExpirationYmdFromToday()}
                    onChange={(e) => setWalkInExpiration(e.target.value)}
                    className="box-border min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeWalkInDonationModal}
                  disabled={walkInSubmitting}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkInSubmitting}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {walkInSubmitting ? 'Recording…' : 'Record donation & update inventory'}
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
                        Blood Type
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
                          {request.requested_blood_type || request.blood_type || '—'}
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
                          {new Date(request.created_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
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

      {isRecallConfirmModalOpen && donorToRecall && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Send recall SMS</h3>
              <button
                type="button"
                onClick={handleCloseRecallConfirmModal}
                className="text-slate-400 hover:text-slate-600"
                disabled={Boolean(recallSmsLoadingId)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-700">
              Send a Semaphore SMS to this donor now? Standard recall wording will be used.
            </p>
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Name:</span>{' '}
                {donorToRecall.full_name ||
                  donorToRecall.fullName ||
                  donorToRecall.donor_name ||
                  donorToRecall.donorName ||
                  '—'}
              </p>
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Phone:</span>{' '}
                {donorToRecall.phone || donorToRecall.contact_phone || donorToRecall.contactPhone || '—'}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCloseRecallConfirmModal}
                disabled={Boolean(recallSmsLoadingId)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRecallSms}
                disabled={Boolean(recallSmsLoadingId)}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {recallSmsLoadingId === donorToRecall.id ? 'Sending…' : 'Send SMS'}
              </button>
            </div>
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

      {isDeleteRc143VolunteerModalOpen && rc143VolunteerToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Delete Volunteer</h3>
              <button
                type="button"
                onClick={handleCloseDeleteRc143VolunteerModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-900">
              Are you sure you want to delete this RC143 volunteer? Assigned activities will also be removed.
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Name:</span> {rc143VolunteerToDelete.fullName || '—'}
              </p>
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Contact:</span> {rc143VolunteerToDelete.contactNumber || rc143VolunteerToDelete.contact || '—'}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCloseDeleteRc143VolunteerModal}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRc143Volunteer}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Delete Volunteer
              </button>
            </div>
          </div>
        </div>
      )}

      {isRc143HistoryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">RC143 Request History</h3>
              <button
                type="button"
                onClick={closeRc143HistoryModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4 max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/95">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-600">
                      Volunteer
                    </th>
                    <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-600">
                      Title
                    </th>
                    <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-600">
                      Details
                    </th>
                    <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-600">
                      Location
                    </th>
                    <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rc143RequestHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        No approved or rejected requests yet.
                      </td>
                    </tr>
                  ) : (
                    rc143RequestHistory.map((r) => (
                      <tr key={`history-${r.id}`} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                          {r.volunteerName || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                          {r.title || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-700">{r.details || '—'}</td>
                        <td className="px-4 py-2 text-sm text-slate-700">{r.location || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                              r.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                                : 'bg-red-100 text-red-800 ring-red-200'
                            }`}
                          >
                            {String(r.status || '').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {profileDiffDonor && (() => {
        const pending = parseDonorPendingProfile(profileDiffDonor)
        const currentName = profileDiffDonor.full_name || profileDiffDonor.fullName || '—'
        const currentPhone = profileDiffDonor.phone || '—'
        const currentBlood = profileDiffDonor.blood_type || profileDiffDonor.bloodType || '—'
        const currentAvatar = profileDiffDonor.profile_image_url || null
        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Review profile changes</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Compare what is on file with what the donor requested. Approve to apply, or reject to keep the
                    current profile.
                  </p>
                  {profileDiffDonor.profile_update_requested_at && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Submitted {new Date(profileDiffDonor.profile_update_requested_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setProfileDiffDonor(null)}
                  disabled={profileReviewLoadingId === profileDiffDonor.id}
                  className="shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!pending ? (
                <p className="mt-4 text-sm text-red-600">Could not read pending profile data.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">On file</th>
                        <th className="px-3 py-2">Requested</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-900">
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-slate-600">Full name</td>
                        <td className="px-3 py-2.5">{currentName}</td>
                        <td className="px-3 py-2.5">{pending.fullName ?? '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-slate-600">Phone</td>
                        <td className="px-3 py-2.5">{currentPhone}</td>
                        <td className="px-3 py-2.5">{pending.phone ?? '—'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-medium text-slate-600">Blood type</td>
                        <td className="px-3 py-2.5">
                          <BloodTypeBadge type={currentBlood} className="text-[11px]" />
                        </td>
                        <td className="px-3 py-2.5">
                          <BloodTypeBadge type={pending.bloodType || '—'} className="text-[11px]" />
                        </td>
                      </tr>
                      <tr>
                        <td className="align-top px-3 py-2.5 font-medium text-slate-600">Photo</td>
                        <td className="px-3 py-2.5">
                          {currentAvatar ? (
                            <img
                              src={currentAvatar}
                              alt=""
                              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {pending.profileImageUrl ? (
                            <img
                              src={pending.profileImageUrl}
                              alt=""
                              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setProfileDiffDonor(null)}
                  disabled={profileReviewLoadingId === profileDiffDonor.id}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={profileReviewLoadingId === profileDiffDonor.id || !pending}
                  onClick={() => handleRejectDonorProfile(profileDiffDonor.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {profileReviewLoadingId === profileDiffDonor.id ? '…' : 'Reject'}
                </button>
                <button
                  type="button"
                  disabled={profileReviewLoadingId === profileDiffDonor.id || !pending}
                  onClick={() => handleApproveDonorProfile(profileDiffDonor.id)}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {profileReviewLoadingId === profileDiffDonor.id ? '…' : 'Approve'}
                </button>
              </div>

            </div>
          </div>
        )
      })()}

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
                <h4 className="text-sm font-semibold text-slate-900 mb-2">User Information</h4>
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
                    <span className="text-slate-500">Requested Blood Type:</span>
                    <span className="ml-2 font-medium text-slate-900">
                      {selectedRequest.requested_blood_type || selectedRequest.blood_type || '—'}
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

                  {selectedRequest.status === 'pending' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  )}

                  <div className="flex flex-wrap justify-end gap-2 pt-4">
                    {selectedRequest.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleReject(selectedRequest.id)}
                        className="inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    )}
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
                        disabled={recordDonationSubmitting}
                        onClick={() => handleRecordDonationComplete(selectedRequest.id)}
                        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {recordDonationSubmitting ? 'Recording…' : 'Complete'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedRequest.status === 'completed' &&
                (selectedRequest.actual_donation_at || selectedRequest.units_donated || selectedRequest.recorded_by_name) && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Recorded donation</h4>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700">
                      {selectedRequest.actual_donation_at && (
                        <p>
                          <span className="text-slate-500">Recorded at: </span>
                          <span className="font-medium text-slate-900">
                            {new Date(selectedRequest.actual_donation_at).toLocaleString()}
                          </span>
                        </p>
                      )}
                      {selectedRequest.units_donated != null && (
                        <p>
                          <span className="text-slate-500">Units: </span>
                          <span className="font-medium text-slate-900">{selectedRequest.units_donated}</span>
                        </p>
                      )}
                      {selectedRequest.recorded_by_name && (
                        <p>
                          <span className="text-slate-500">Recorded by: </span>
                          <span className="font-medium text-slate-900">{selectedRequest.recorded_by_name}</span>
                        </p>
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
                        Actual donation
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                        Units
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
                          {request.status === 'completed' && request.actual_donation_at
                            ? new Date(request.actual_donation_at).toLocaleString()
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                          {request.status === 'completed' && request.units_donated != null
                            ? request.units_donated
                            : '—'}
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
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
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

            <div className="flex justify-center border-b border-slate-200 pb-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 text-2xl font-semibold text-white shadow-md ring-2 ring-slate-100">
                {selectedDonorDetails.donor.profileImageUrl &&
                !selectedDonorDetails.donor.isManualDonor &&
                !donorDetailAvatarFailed ? (
                  <img
                    src={selectedDonorDetails.donor.profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setDonorDetailAvatarFailed(true)}
                  />
                ) : (
                  (selectedDonorDetails.donor.fullName || '?').trim().charAt(0).toUpperCase() || '?'
                )}
              </div>
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

              {Array.isArray(selectedDonorDetails.donationHistory) &&
                selectedDonorDetails.donationHistory.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Donation history (admin-recorded)
                    </h4>
                    <ul className="max-h-52 space-y-2 overflow-y-auto pr-1 text-[11px]">
                      {selectedDonorDetails.donationHistory.map((h) => (
                        <li
                          key={h.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-slate-800"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-1">
                            <span className="font-semibold text-slate-900">
                              {h.donationDate
                                ? new Date(h.donationDate).toLocaleString()
                                : '—'}
                            </span>
                            <span className="text-slate-600">
                              {h.unitsDonated} unit{h.unitsDonated === 1 ? '' : 's'} ·{' '}
                              {h.componentType === 'whole_blood'
                                ? 'Whole blood'
                                : h.componentType === 'platelets'
                                  ? 'Platelets'
                                  : 'Plasma'}
                            </span>
                          </div>
                          {h.recordedByName && (
                            <p className="mt-1 text-[10px] text-slate-500">
                              Recorded by {h.recordedByName}
                              {h.inventoryId ? ` · Inventory #${h.inventoryId}` : ''}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

      <DonorBroadcastModal open={donorBroadcastOpen} onClose={() => setDonorBroadcastOpen(false)} />
    </AdminLayout>
  )
}

export default AdminDonation
