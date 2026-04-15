import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'
import { BrandLogo } from './BrandLogo.jsx'
import { responsiveTableContainer } from './admin-ui.jsx'
import { DashboardAnnouncementsPanel } from './AnnouncementFeed.jsx'
import { useFeatureFlags } from './featureFlagsContext.jsx'

const RC143_VOLUNTEERS_KEY = 'bloodconnect_rc143_volunteers'
const RC143_REQUESTS_KEY = 'bloodconnect_rc143_activity_requests'
const SCHEDULE_BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function UserDashboard() {
  const navigate = useNavigate()
  const { isFlagEnabled } = useFeatureFlags()
  const showAnnouncements = isFlagEnabled('user', 'user.announcements')
  const showNotifications = isFlagEnabled('user', 'user.notifications')
  const showProfile = isFlagEnabled('user', 'user.profile')
  const showSchedule = isFlagEnabled('user', 'user.schedule')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [announcementsPanelOpen, setAnnouncementsPanelOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [eligibility, setEligibility] = useState(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)
  const [nowTs, setNowTs] = useState(Date.now())
  const [cooldownModal, setCooldownModal] = useState({ open: false, message: '' })
  const [notifications, setNotifications] = useState([])
  const [scheduleRequest, setScheduleRequest] = useState(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [isRc143Volunteer, setIsRc143Volunteer] = useState(false)
  const [rc143MyRequests, setRc143MyRequests] = useState([])
  const [isRequestActivityModalOpen, setIsRequestActivityModalOpen] = useState(false)
  const [isRequestHistoryModalOpen, setIsRequestHistoryModalOpen] = useState(false)
  const [activityRequestForm, setActivityRequestForm] = useState({
    title: '',
    details: '',
    location: '',
  })

  const [userData, setUserData] = useState({
    name: '',
    bloodType: '',
    status: 'Available',
    totalDonations: 0,
    avatar: null,
  })

  const [donationHistory, setDonationHistory] = useState([])

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    preferredDate: '',
    preferredTime: '',
    bloodType: '',
    componentType: 'whole_blood',
    weight: '50',
    healthScreening: {
      hasDoctorRecommendation: '',
      hasHospitalCoordination: '',
      isUrgentWithin24Hours: '',
      hasRequiredBloodTypeInfo: '',
      hasPatientConsent: '',
    },
    notes: '',
    confirmation: false,
  })

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError('')
      try {
        const [
          me,
          donations,
          scheduleRequests,
          notificationsData,
          eligibilityData,
        ] = await Promise.all([
          apiRequest('/api/user/me'),
          apiRequest('/api/user/donations'),
          apiRequest('/api/user/schedule-requests').catch(() => []),
          apiRequest('/api/notifications').catch(() => []),
          apiRequest('/api/user/donation-eligibility').catch(() => null),
        ])

        const username = (me.username || '').toLowerCase()
        const needsProfileSetup =
          (me.role === 'donor' || localStorage.getItem('role') === 'donor') &&
          (!me.phone || !me.blood_type || username.startsWith('google_'))
        if (needsProfileSetup) {
          navigate('/complete-google-donor-profile')
          return
        }

        // Determine overall status from eligibility (if available)
        const overallStatus = (() => {
          if (!eligibilityData) return 'Available'
          const types = ['whole_blood', 'platelets', 'plasma']
          const now = Date.now()
          const anyEligible = types.some((t) => {
            const info = eligibilityData[t]
            if (!info) return true
            const serverEligible = info.isEligible
            const nextEligibleAt = info.nextEligibleAt ? new Date(info.nextEligibleAt).getTime() : null
            const locallyEligible = serverEligible || (nextEligibleAt && nextEligibleAt <= now)
            return locallyEligible
          })
          return anyEligible ? 'Available' : 'Ineligible'
        })()

        const donationCount = (donations || []).length
        const completedDonationSchedules = (scheduleRequests || []).filter(
          (r) => r.status === 'completed' && r.actual_donation_at,
        ).length
        const totalDonations = donationCount + completedDonationSchedules

        const avatarStorageKey = me.id ? `profileAvatar:${me.id}` : ''
        const savedAvatar = avatarStorageKey ? localStorage.getItem(avatarStorageKey) : null
        const serverAvatar = me.profile_image_url || me.profileImageUrl || null

        setUserData({
          name: me.full_name || me.fullName || me.username || 'Donor',
          bloodType: me.blood_type || me.bloodType || '—',
          status: overallStatus,
          totalDonations,
          avatar: serverAvatar || savedAvatar || null,
        })

        const formattedDonations = (donations || []).map((d) => ({
          id: d.id,
          date: d.donation_date || d.donationDate,
          bloodType: d.blood_type || d.bloodType,
          location: d.location || (d.hospital_id ? `Hospital #${d.hospital_id}` : '—'),
          status: d.status || 'Completed',
          type: 'donation',
        }))

        // Completed schedule rows that recorded a real donation (not blood-request fulfillment)
        const completedScheduleEntries = (scheduleRequests || [])
          .filter((req) => req.status === 'completed' && req.actual_donation_at)
          .map((req) => ({
            id: `schedule-${req.id}`,
            date: req.preferred_date,
            bloodType: me.blood_type || me.bloodType || '—',
            componentType: req.component_type || 'whole_blood',
            location: 'Scheduled donation',
            status: 'Completed',
            type: 'schedule',
            preferredTime: req.preferred_time,
            adminNotes: req.admin_notes,
          }))

        // Combine donations and completed schedules, sort by date (newest first)
        const combinedHistory = [...formattedDonations, ...completedScheduleEntries].sort(
          (a, b) => new Date(b.date) - new Date(a.date),
        )

        setDonationHistory(combinedHistory)

        const meId = me?.id ? String(me.id) : ''
        setCurrentUserId(meId)

        // Volunteer requests are stored locally from admin-donations RC143.
        let volunteerEntries = []
        let allRequests = []
        try {
          const rawVolunteers = localStorage.getItem(RC143_VOLUNTEERS_KEY)
          const parsedVolunteers = rawVolunteers ? JSON.parse(rawVolunteers) : []
          volunteerEntries = Array.isArray(parsedVolunteers) ? parsedVolunteers : []
        } catch {
          volunteerEntries = []
        }
        try {
          const rawRequests = localStorage.getItem(RC143_REQUESTS_KEY)
          const parsedRequests = rawRequests ? JSON.parse(rawRequests) : []
          allRequests = Array.isArray(parsedRequests) ? parsedRequests : []
        } catch {
          allRequests = []
        }
        const matchedVolunteer = volunteerEntries.find((v) => String(v.sourceUserId || '') === meId)
        setIsRc143Volunteer(Boolean(matchedVolunteer))
        if (matchedVolunteer) {
          const mine = allRequests
            .filter((r) => String(r.volunteerId) === String(matchedVolunteer.id))
            .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0))
          setRc143MyRequests(mine)
        } else {
          setRc143MyRequests([])
        }

        // Set latest schedule request (including pending)
        if (scheduleRequests && scheduleRequests.length > 0) {
          setScheduleRequest(scheduleRequests[0])
        }

        // Set notifications
        setNotifications(notificationsData || [])

        // Set initial eligibility (used when opening the modal)
        if (eligibilityData) {
          setEligibility(eligibilityData)
        }
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [navigate])

  useEffect(() => {
    const syncMyRc143Requests = () => {
      if (!currentUserId) return
      let volunteerEntries = []
      let allRequests = []
      try {
        const rawVolunteers = localStorage.getItem(RC143_VOLUNTEERS_KEY)
        const parsedVolunteers = rawVolunteers ? JSON.parse(rawVolunteers) : []
        volunteerEntries = Array.isArray(parsedVolunteers) ? parsedVolunteers : []
      } catch {
        volunteerEntries = []
      }
      try {
        const rawRequests = localStorage.getItem(RC143_REQUESTS_KEY)
        const parsedRequests = rawRequests ? JSON.parse(rawRequests) : []
        allRequests = Array.isArray(parsedRequests) ? parsedRequests : []
      } catch {
        allRequests = []
      }
      const matchedVolunteer = volunteerEntries.find((v) => String(v.sourceUserId || '') === String(currentUserId))
      if (!matchedVolunteer) {
        setRc143MyRequests([])
        return
      }
      const mine = allRequests
        .filter((r) => String(r.volunteerId) === String(matchedVolunteer.id))
        .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0))
      setRc143MyRequests(mine)
    }

    window.addEventListener('storage', syncMyRc143Requests)
    window.addEventListener('focus', syncMyRc143Requests)
    return () => {
      window.removeEventListener('storage', syncMyRc143Requests)
      window.removeEventListener('focus', syncMyRc143Requests)
    }
  }, [currentUserId])

  // Tick "now" while schedule modal is open so cooldown countdowns update
  useEffect(() => {
    if (!isScheduleModalOpen) return
    const interval = setInterval(() => {
      setNowTs(Date.now())
    }, 60000) // update every minute
    return () => clearInterval(interval)
  }, [isScheduleModalOpen])

  const handleOpenScheduleModal = async () => {
    setError('')
    setEligibilityLoading(true)
    try {
      const data = await apiRequest('/api/user/donation-eligibility')
      setEligibility(data)

      const fromProfile = (userData.bloodType || '').trim()
      const profileBlood = SCHEDULE_BLOOD_TYPE_OPTIONS.includes(fromProfile) ? fromProfile : ''

      setScheduleForm((prev) => ({
        ...prev,
        /* Blood request uses schedule_requests row for logistics only; keep component as WB for legacy admin paths */
        componentType: 'whole_blood',
        bloodType: profileBlood,
      }))

      setIsScheduleModalOpen(true)
    } catch (err) {
      setError(err.message || 'Failed to load donation eligibility')
    } finally {
      setEligibilityLoading(false)
    }
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/user/schedule-requests', {
        method: 'POST',
        body: JSON.stringify({
          preferredDate: scheduleForm.preferredDate,
          preferredTime: scheduleForm.preferredTime,
          bloodType: scheduleForm.bloodType,
          componentType: 'whole_blood',
          weight: parseFloat(scheduleForm.weight),
          healthScreeningAnswers: scheduleForm.healthScreening,
          notes: scheduleForm.notes || null,
        }),
      })

      setIsScheduleModalOpen(false)
      // Reset form
      setScheduleForm({
        preferredDate: '',
        preferredTime: '',
        bloodType: '',
        componentType: 'whole_blood',
        weight: '50',
        healthScreening: {
          hasDoctorRecommendation: '',
          hasHospitalCoordination: '',
          isUrgentWithin24Hours: '',
          hasRequiredBloodTypeInfo: '',
          hasPatientConsent: '',
        },
        notes: '',
        confirmation: false,
      })

      // Reload data to show new request
      window.location.reload()
    } catch (err) {
      const message = err.message || 'Failed to submit blood request'
      if (message.toLowerCase().includes('still in cooldown')) {
        setCooldownModal({ open: true, message })
      } else {
        setError(message)
      }
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-700 ring-green-200'
      case 'Waiting':
        return 'bg-yellow-100 text-yellow-700 ring-yellow-200'
      case 'Ineligible':
        return 'bg-red-100 text-red-700 ring-red-200'
      case 'Matched':
        return 'bg-blue-100 text-blue-700 ring-blue-200'
      case 'Completed':
        return 'bg-green-100 text-green-700 ring-green-200'
      case 'Scheduled':
        return 'bg-blue-100 text-blue-700 ring-blue-200'
      case 'Cancelled':
        return 'bg-red-100 text-red-700 ring-red-200'
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200'
    }
  }

  const getRc143RequestStatusColor = (status) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
    if (status === 'rejected') return 'bg-red-100 text-red-700 ring-red-200'
    return 'bg-amber-100 text-amber-700 ring-amber-200'
  }

  const formatCooldownRemaining = (nextEligibleAt) => {
    if (!nextEligibleAt) return null
    const diffMs = new Date(nextEligibleAt).getTime() - nowTs
    if (diffMs <= 0) return 'Available now'
    const totalMinutes = Math.floor(diffMs / (1000 * 60))
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` ${hours} hour${hours !== 1 ? 's' : ''}` : ''}`
    }
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    }
    return 'Less than 1 hour'
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/')
  }

  const openRequestActivityModal = () => {
    setActivityRequestForm({
      title: '',
      details: '',
      location: '',
    })
    setIsRequestActivityModalOpen(true)
  }

  const closeRequestActivityModal = () => {
    setIsRequestActivityModalOpen(false)
  }

  const openRequestHistoryModal = () => {
    setIsRequestHistoryModalOpen(true)
  }

  const closeRequestHistoryModal = () => {
    setIsRequestHistoryModalOpen(false)
  }

  const handleSubmitActivityRequest = (e) => {
    e.preventDefault()
    const title = activityRequestForm.title.trim()
    if (!title) {
      setError('Please provide a request title.')
      return
    }
    let volunteerEntries = []
    try {
      const rawVolunteers = localStorage.getItem(RC143_VOLUNTEERS_KEY)
      const parsedVolunteers = rawVolunteers ? JSON.parse(rawVolunteers) : []
      volunteerEntries = Array.isArray(parsedVolunteers) ? parsedVolunteers : []
    } catch {
      volunteerEntries = []
    }
    const matchedVolunteer = volunteerEntries.find((v) => String(v.sourceUserId || '') === String(currentUserId))
    if (!matchedVolunteer) {
      setError('Your account is not currently assigned as RC143 volunteer.')
      return
    }
    let allRequests = []
    try {
      const rawRequests = localStorage.getItem(RC143_REQUESTS_KEY)
      const parsedRequests = rawRequests ? JSON.parse(rawRequests) : []
      allRequests = Array.isArray(parsedRequests) ? parsedRequests : []
    } catch {
      allRequests = []
    }
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `rq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const nextRequest = {
      id: requestId,
      volunteerId: matchedVolunteer.id,
      volunteerName: matchedVolunteer.fullName || userData.name,
      title,
      details: activityRequestForm.details.trim(),
      location: activityRequestForm.location.trim(),
      status: 'pending',
      requestedAt: new Date().toISOString(),
    }
    const updatedRequests = [nextRequest, ...allRequests]
    localStorage.setItem(RC143_REQUESTS_KEY, JSON.stringify(updatedRequests))
    setRc143MyRequests((prev) => [nextRequest, ...prev])
    setError('')
    closeRequestActivityModal()
  }

  const rc143RequestHistory = rc143MyRequests
    .filter((req) => req.status === 'approved' || req.status === 'rejected')
    .sort((a, b) => {
      const aTs = new Date(a.reviewedAt || a.requestedAt || 0).getTime()
      const bTs = new Date(b.reviewedAt || b.requestedAt || 0).getTime()
      return bTs - aTs
    })

  return (
    <div className="min-h-screen">
      {/* Top Header */}
      <header className="z-30 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">BloodConnect</h1>
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-700">Donor portal</p>
            </div>
          </div>

          {/* Right: Announcements panel, notifications, profile, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {showAnnouncements && (
              <button
                type="button"
                onClick={() => setAnnouncementsPanelOpen((o) => !o)}
                className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 sm:gap-2 sm:px-3 sm:pr-4 ${
                  announcementsPanelOpen
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                aria-expanded={announcementsPanelOpen}
                aria-controls="announcements-side-panel"
                title="Announcements"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5.882V19.24a1.76 1.76 0 001.759 1.759h.282a1.76 1.76 0 001.759-1.759V5.882M12 5.882V4.5M9.5 9h5"
                  />
                </svg>
                <span className="hidden text-xs font-semibold sm:inline">Announcements</span>
              </button>
            )}

            {/* Notifications */}
            {showNotifications && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600"></span>
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="fixed top-16 right-0 left-0 z-50 mx-auto mt-2 w-[min(100%,calc(100vw-2rem))] max-w-sm rounded-xl bg-white shadow-lg ring-1 ring-slate-200 sm:absolute sm:inset-auto sm:right-0 sm:left-auto sm:mt-2 sm:w-80 sm:max-w-none">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                      <div className="rounded-lg px-3 py-2 text-sm text-slate-500">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`mb-2 rounded-lg px-3 py-2 text-sm ${
                            notif.is_read
                              ? 'bg-slate-50 text-slate-600'
                              : 'bg-blue-50 text-blue-900'
                          }`}
                        >
                          <div className="font-semibold">{notif.title}</div>
                          <div className="mt-1 text-xs">{notif.message}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* User Profile */}
            {showProfile && (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 sm:px-0"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white ring-1 ring-red-700/20">
                  {userData.avatar ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    userData.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="hidden text-sm font-medium text-slate-700 sm:inline-block">
                  {userData.name}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
              title="Logout"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline-block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content — single centered column; announcements live in slide-out panel */}
      <main className="w-full py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:py-6">
        {error && (
          <p className="mb-4 px-3 text-sm text-red-600 sm:px-6 lg:px-8">
            {error}
          </p>
        )}
        <div className="mx-auto w-full max-w-4xl space-y-8 px-3 sm:px-6 lg:px-8">
        {/* Hero Section - Statistic Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Blood Type Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/90">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Blood Type
            </p>
            <div className="mt-2">
              {isLoading ? (
                <span className="text-3xl font-semibold text-slate-400">—</span>
              ) : (
                <BloodTypeBadge type={userData.bloodType} className="!text-2xl !px-4 !py-1.5 !min-w-[4.5rem] font-semibold" />
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">Your registered blood group</p>
          </div>

          {/* Total Donations Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/90">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Total Donations
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {isLoading ? '—' : userData.totalDonations}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {userData.totalDonations === 1 ? 'donation so far' : 'donations so far'}
            </p>
          </div>
        </section>

        {/* Donation Eligibility Section (per component type) */}
        <section className="mb-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/90">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Blood request eligibility</h3>
                <p className="mt-1 text-xs text-slate-500">
                  See which blood components you can request to schedule today
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {['whole_blood', 'platelets', 'plasma'].map((type) => {
                const info = eligibility?.[type]
                const label =
                  type === 'whole_blood' ? 'Whole Blood' : type === 'platelets' ? 'Platelets' : 'Plasma'
                const isEligible = (() => {
                  if (!info) return true
                  const serverEligible = info.isEligible
                  const nextEligibleAt = info.nextEligibleAt ? new Date(info.nextEligibleAt).getTime() : null
                  return serverEligible || (nextEligibleAt && nextEligibleAt <= nowTs)
                })()
                const nextEligibleAt = info?.nextEligibleAt || null
                const remaining = nextEligibleAt ? formatCooldownRemaining(nextEligibleAt) : null
                const statusLabel = isEligible ? 'Eligible now' : 'In cooldown'
                const statusColor = isEligible
                  ? 'bg-green-100 text-green-700 ring-green-200'
                  : 'bg-amber-100 text-amber-700 ring-amber-200'

                return (
                  <div
                    key={type}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                      {label}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                      {isEligible
                        ? 'You can request this blood component now.'
                        : nextEligibleAt
                          ? `Available on ${new Date(nextEligibleAt).toLocaleDateString()} (${remaining}).`
                          : 'Cooldown information unavailable.'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Blood request status */}
        {showSchedule && scheduleRequest && (
          <section className="mb-8">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100/90">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Blood request status</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Preferred Date: {new Date(scheduleRequest.preferred_date).toLocaleDateString()} at{' '}
                    {scheduleRequest.preferred_time}
                  </p>
                  {scheduleRequest.requested_blood_type && (
                    <p className="mt-1 text-xs text-slate-500">
                      Requested blood type:{' '}
                      <span className="font-medium text-slate-700">{scheduleRequest.requested_blood_type}</span>
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    scheduleRequest.status === 'approved'
                      ? 'bg-green-100 text-green-700 ring-green-200'
                      : scheduleRequest.status === 'rejected'
                        ? 'bg-red-100 text-red-700 ring-red-200'
                        : 'bg-yellow-100 text-yellow-700 ring-yellow-200'
                  }`}
                >
                  {scheduleRequest.status.charAt(0).toUpperCase() + scheduleRequest.status.slice(1)}
                </span>
              </div>
              {scheduleRequest.admin_notes && (
                <p className="mt-2 text-xs text-slate-600">
                  <strong>Admin Notes:</strong> {scheduleRequest.admin_notes}
                </p>
              )}
              {scheduleRequest.rejection_reason && (
                <p className="mt-2 text-xs text-red-600">
                  <strong>Rejection Reason:</strong> {scheduleRequest.rejection_reason}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Schedule blood request */}
        {showSchedule && (
          <section className="mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleOpenScheduleModal}
                disabled={scheduleRequest && scheduleRequest.status === 'pending'}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition sm:w-auto sm:py-2 ${
                  scheduleRequest && scheduleRequest.status === 'pending'
                    ? 'cursor-not-allowed bg-slate-400'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {scheduleRequest && scheduleRequest.status === 'pending'
                  ? 'Blood request pending'
                  : 'Schedule blood request'}
              </button>
              {isRc143Volunteer && (
                <>
                  <button
                    type="button"
                    onClick={openRequestActivityModal}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto sm:py-2"
                  >
                    Request Activity
                  </button>
                  <button
                    type="button"
                    onClick={openRequestHistoryModal}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto sm:py-2"
                  >
                    Request History
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {isRc143Volunteer && (
          <section className="mb-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/90">
              <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">My RC143 Activity Requests</h2>
                <p className="mt-1 text-sm text-slate-500">Track approval status of your blood drive/program requests.</p>
              </div>
              <div className={`${responsiveTableContainer}`}>
                <table className="min-w-[680px] divide-y divide-slate-100 sm:min-w-full">
                  <thead className="bg-slate-50/95">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                        Title
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rc143MyRequests.length === 0 ? (
                      <tr>
                        <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={2}>
                          No activity requests yet.
                        </td>
                      </tr>
                    ) : (
                      rc143MyRequests.map((req) => (
                        <tr key={req.id} className="transition hover:bg-slate-50/50">
                          <td className="px-4 py-4 text-sm text-slate-900 sm:px-6">
                            <p className="font-medium">{req.title || '—'}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{req.details || 'No details provided.'}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700 sm:px-6">{req.location || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Main Content Section - Donation History */}
        <section>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/90">
            <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Donation history</h2>
              <p className="mt-1 text-sm text-slate-500">
                View your past donation records
              </p>
            </div>

            <div className={`${responsiveTableContainer}`}>
              <table className="min-w-[640px] divide-y divide-slate-100 sm:min-w-full">
                <thead className="bg-slate-50/95">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                      Donation Date
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                      Blood Type
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                      Admin Notes
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <tr>
                      <td
                        className="px-6 py-10 text-center text-sm text-slate-500"
                        colSpan={4}
                      >
                        Loading donation history...
                      </td>
                    </tr>
                  ) : donationHistory.length > 0 ? (
                    donationHistory.map((donation) => (
                      <tr
                        key={donation.id}
                        className="transition hover:bg-slate-50/50"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900 sm:px-6">
                          {donation.type === 'schedule' && donation.preferredTime
                            ? `${new Date(donation.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })} at ${donation.preferredTime}`
                            : new Date(donation.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900 sm:px-6">
                          <BloodTypeBadge type={donation.bloodType} className="text-sm" />
                          {donation.type === 'schedule' && donation.componentType && (
                            <span className="ml-2 text-xs text-slate-500">
                              ({donation.componentType === 'whole_blood' ? 'Whole Blood' : donation.componentType === 'platelets' ? 'Platelets' : donation.componentType === 'plasma' ? 'Plasma' : 'Whole Blood'})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 sm:px-6">
                          {donation.type === 'schedule' && donation.adminNotes
                            ? donation.adminNotes
                            : donation.type === 'donation'
                              ? '—'
                              : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm sm:px-6">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusColor(donation.status)}`}
                          >
                            {donation.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="px-6 py-10 text-center text-sm text-slate-500"
                        colSpan={4}
                      >
                        No donation history available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </div>
      </main>

      {showAnnouncements && (
        <DashboardAnnouncementsPanel open={announcementsPanelOpen} onClose={() => setAnnouncementsPanelOpen(false)} />
      )}

      {/* Blood request schedule modal */}
      {showSchedule && isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 pr-2">
                <h3 className="text-lg font-semibold text-slate-900">Schedule a blood request</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Choose a preferred date and time for your blood request. Staff will review and confirm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="shrink-0 text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.preferredDate}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, preferredDate: e.target.value })
                    }
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.preferredTime}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, preferredTime: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Blood type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={scheduleForm.bloodType}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, bloodType: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                >
                  <option value="">Select blood type</option>
                  {SCHEDULE_BLOOD_TYPE_OPTIONS.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={scheduleForm.notes}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Describe your blood request..."
                />
              </div>

              {/* Blood request screening questions */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Blood Request Screening</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Has a doctor recommended this blood request? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.hasDoctorRecommendation}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            hasDoctorRecommendation: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Have you coordinated this request with a hospital or blood bank?{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.hasHospitalCoordination}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            hasHospitalCoordination: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Is this blood request urgent within 24 hours? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.isUrgentWithin24Hours}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            isUrgentWithin24Hours: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Do you already know the required blood type for this request?{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.hasRequiredBloodTypeInfo}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            hasRequiredBloodTypeInfo: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Do you have patient/family consent to proceed with this request?{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.hasPatientConsent}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            hasPatientConsent: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  required
                  checked={scheduleForm.confirmation}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, confirmation: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500/40"
                />
                <label className="text-xs text-slate-700">
                  I confirm all information is true <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Submit blood request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isRequestActivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Request Activity</h3>
              <button
                type="button"
                onClick={closeRequestActivityModal}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitActivityRequest} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  value={activityRequestForm.title}
                  onChange={(e) => setActivityRequestForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Ex: Community Blood Drive - July 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Details</label>
                <textarea
                  rows={3}
                  value={activityRequestForm.details}
                  onChange={(e) => setActivityRequestForm((prev) => ({ ...prev, details: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Describe target participants and support needed."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Location</label>
                <input
                  type="text"
                  value={activityRequestForm.location}
                  onChange={(e) => setActivityRequestForm((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Venue or address"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRequestActivityModal}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isRequestHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Request History</h3>
              <button
                type="button"
                onClick={closeRequestHistoryModal}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/95">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Title
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Details
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Location
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rc143RequestHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                        No approved or rejected requests yet.
                      </td>
                    </tr>
                  ) : (
                    rc143RequestHistory.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">{req.title || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{req.details || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{req.location || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getRc143RequestStatusColor(req.status)}`}>
                            {String(req.status || '').toUpperCase()}
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
      {/* Cooldown Info Modal */}
      {cooldownModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl ring-1 ring-slate-100">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">Donation Cooldown</h3>
              <button
                type="button"
                onClick={() => setCooldownModal({ open: false, message: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-700">
              {cooldownModal.message}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setCooldownModal({ open: false, message: '' })}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDashboard

