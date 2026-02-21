import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'

function UserDashboard() {
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [scheduleRequest, setScheduleRequest] = useState(null)

  const [userData, setUserData] = useState({
    name: '',
    bloodType: '',
    status: 'Available',
    bloodAvailable: '(Blood stocks)',
    avatar: null,
  })

  const [donationHistory, setDonationHistory] = useState([])

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    preferredDate: '',
    preferredTime: '',
    componentType: 'whole_blood',
    lastDonationDate: '',
    weight: '',
    healthScreening: {
      feelingHealthy: '',
      recentIllness: '',
      medications: '',
      travelHistory: '',
      riskFactors: '',
    },
    notes: '',
    confirmation: false,
  })

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError('')
      try {
        const [me, donations, scheduleRequests, notificationsData] = await Promise.all([
          apiRequest('/api/user/me'),
          apiRequest('/api/user/donations'),
          apiRequest('/api/user/schedule-requests').catch(() => []),
          apiRequest('/api/notifications').catch(() => []),
        ])

        setUserData({
          name: me.full_name || me.fullName || me.username || 'Donor',
          bloodType: me.blood_type || me.bloodType || '—',
          status: 'Available',
          bloodAvailable: '(Blood stocks)',
          avatar: null,
        })

        const formattedDonations = (donations || []).map((d) => ({
          id: d.id,
          date: d.donation_date || d.donationDate,
          bloodType: d.blood_type || d.bloodType,
          location: d.location || (d.hospital_id ? `Hospital #${d.hospital_id}` : '—'),
          status: d.status || 'Completed',
          type: 'donation',
        }))

        // Get approved schedule requests and add them to donation history
        const approvedSchedules = (scheduleRequests || [])
          .filter((req) => req.status === 'approved')
          .map((req) => ({
            id: `schedule-${req.id}`,
            date: req.preferred_date,
            bloodType: me.blood_type || me.bloodType || '—',
            componentType: req.component_type || 'whole_blood',
            location: 'Scheduled Donation',
            status: 'Scheduled',
            type: 'schedule',
            preferredTime: req.preferred_time,
            adminNotes: req.admin_notes,
          }))

        // Combine donations and approved schedules, sort by date (newest first)
        const combinedHistory = [...formattedDonations, ...approvedSchedules].sort(
          (a, b) => new Date(b.date) - new Date(a.date),
        )

        setDonationHistory(combinedHistory)

        // Set latest schedule request (including pending)
        if (scheduleRequests && scheduleRequests.length > 0) {
          setScheduleRequest(scheduleRequests[0])
        }

        // Set notifications
        setNotifications(notificationsData || [])
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleLogout = () => {
    // Clear authentication tokens and user data
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    // Navigate to home page
    navigate('/')
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/user/schedule-requests', {
        method: 'POST',
        body: JSON.stringify({
          preferredDate: scheduleForm.preferredDate,
          preferredTime: scheduleForm.preferredTime,
          componentType: scheduleForm.componentType,
          lastDonationDate: scheduleForm.lastDonationDate || null,
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
        componentType: 'whole_blood',
        lastDonationDate: '',
        weight: '',
        healthScreening: {
          feelingHealthy: '',
          recentIllness: '',
          medications: '',
          travelHistory: '',
          riskFactors: '',
        },
        notes: '',
        confirmation: false,
      })

      // Reload data to show new request
      window.location.reload()
    } catch (err) {
      setError(err.message || 'Failed to submit schedule request')
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

  return (
    <div className="min-h-screen bg-red-50">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Left: Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-red-600">BloodConnect</h1>
          </div>

          {/* Right: User profile and notifications */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
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

            {/* User Profile */}
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white">
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

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Logout"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <p className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}
        {/* Hero Section - Three Statistic Cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {/* Blood Type Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-medium text-slate-500">Blood Type</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {isLoading ? '—' : userData.bloodType || '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Your blood group</p>
          </div>

          {/* Status Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-medium text-slate-500">Status</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusColor(userData.status)}`}
              >
                {userData.status}
              </span>
            </div>
          </div>

          {/* Blood Available Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-medium text-slate-500">Blood Available</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {userData.bloodAvailable}
            </p>
          </div>
        </section>

        {/* Schedule Request Section */}
        {scheduleRequest && (
          <section className="mb-8">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Schedule Request Status</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Preferred Date: {new Date(scheduleRequest.preferred_date).toLocaleDateString()} at{' '}
                    {scheduleRequest.preferred_time}
                  </p>
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

        {/* Set Schedule Button */}
        <section className="mb-8">
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            disabled={scheduleRequest && scheduleRequest.status === 'pending'}
            className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
              scheduleRequest && scheduleRequest.status === 'pending'
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {scheduleRequest && scheduleRequest.status === 'pending'
              ? 'Schedule Request Pending'
              : 'Set Schedule'}
          </button>
        </section>

        {/* Main Content Section - Donation History */}
        <section>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Donation History</h2>
              <p className="mt-1 text-sm text-slate-500">
                View your past donation records
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/60">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-slate-500">
                      Donation Date
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-slate-500">
                      Blood Type
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-slate-500">
                      Admin Notes
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-slate-500">
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
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
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
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                          {donation.bloodType}
                          {donation.type === 'schedule' && donation.componentType && (
                            <span className="ml-2 text-xs text-slate-500">
                              ({donation.componentType === 'whole_blood' ? 'Whole Blood' : donation.componentType === 'platelets' ? 'Platelets' : donation.componentType === 'plasma' ? 'Plasma' : 'Whole Blood'})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {donation.type === 'schedule' && donation.adminNotes
                            ? donation.adminNotes
                            : donation.type === 'donation'
                              ? '—'
                              : '—'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
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
      </main>

      {/* Schedule Request Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Set Schedule</h3>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Eligibility Guidelines */}
            <div className="mb-6 rounded-lg bg-blue-50 p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Requirements / Eligibility Guidelines</h4>
              <ul className="space-y-1 text-xs text-blue-800 list-disc list-inside">
                <li>Must meet minimum age requirement</li>
                <li>Must meet minimum weight requirement</li>
                <li>Must be feeling healthy</li>
                <li>Must not have donated within the restricted period</li>
                <li>Must answer health screening honestly</li>
              </ul>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Component Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={scheduleForm.componentType}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, componentType: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="whole_blood">Whole Blood</option>
                  <option value="platelets">Platelets</option>
                  <option value="plasma">Plasma</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Donation Date
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.lastDonationDate}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, lastDonationDate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Weight (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={scheduleForm.weight}
                    onChange={(e) =>
                      setScheduleForm({ ...scheduleForm, weight: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Health Screening Questions */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Health Screening Questions</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Are you feeling healthy today? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.feelingHealthy}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            feelingHealthy: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Have you had any recent illness? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.recentIllness}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            recentIllness: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Are you currently taking any medications? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.medications}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            medications: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Have you traveled recently? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.travelHistory}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            travelHistory: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Do you have any risk factors? <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={scheduleForm.healthScreening.riskFactors}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          healthScreening: {
                            ...scheduleForm.healthScreening,
                            riskFactors: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  required
                  checked={scheduleForm.confirmation}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, confirmation: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <label className="text-xs text-slate-700">
                  I confirm all information is true <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDashboard

