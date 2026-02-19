import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'

function UserDashboard() {
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [userData, setUserData] = useState({
    name: '',
    bloodType: '',
    status: 'Available',
    bloodAvailable: '(Blood stocks)',
    avatar: null,
  })

  const [donationHistory, setDonationHistory] = useState([])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError('')
      try {
        const [me, donations] = await Promise.all([
          apiRequest('/api/user/me'),
          apiRequest('/api/user/donations'),
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
        }))

        setDonationHistory(formattedDonations)
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
                    <div className="rounded-lg px-3 py-2 text-sm text-slate-500">
                      No new notifications
                    </div>
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
                      Location / Hospital
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
                          {new Date(donation.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                          {donation.bloodType}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {donation.location}
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
    </div>
  )
}

export default UserDashboard

