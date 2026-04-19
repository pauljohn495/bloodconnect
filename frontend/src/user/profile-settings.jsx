import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api.js'
import { BloodTypeBadge } from '../BloodTypeBadge.jsx'
import { BrandLogo } from '../BrandLogo.jsx'

function ProfileSettings() {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [pendingProfile, setPendingProfile] = useState(null)
  const [userRole, setUserRole] = useState('')
  const [avatarStorageKey, setAvatarStorageKey] = useState('')

  const [profileData, setProfileData] = useState({
    name: '',
    username: '',
    phone: '',
    email: '',
    bloodType: '',
    lastDonationDate: null,
    avatar: null,
  })

  const [editedData, setEditedData] = useState(profileData)

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true)
      setError('')
      try {
        const [data, notificationsData] = await Promise.all([
          apiRequest('/api/user/me'),
          apiRequest('/api/notifications').catch(() => []),
        ])
        const perUserAvatarKey = data.id ? `profileAvatar:${data.id}` : ''
        const savedAvatar = perUserAvatarKey ? localStorage.getItem(perUserAvatarKey) : null
        const serverAvatar = data.profile_image_url || data.profileImageUrl || null
        const avatar = serverAvatar || savedAvatar || null
        setAvatarStorageKey(perUserAvatarKey)

        setUserRole(data.role || '')
        setPendingProfile(data.pending_profile || data.pendingProfile || null)

        setNotifications(Array.isArray(notificationsData) ? notificationsData : [])

        setProfileData({
          name: data.full_name || '',
          username: data.username || '',
          phone: data.phone || '',
          email: data.email || '',
          bloodType: data.blood_type || '',
          lastDonationDate: data.last_donation_date || null,
          avatar,
        })
        setEditedData({
          name: data.full_name || '',
          username: data.username || '',
          phone: data.phone || '',
          email: data.email || '',
          bloodType: data.blood_type || '',
          lastDonationDate: data.last_donation_date || null,
          avatar,
        })
      } catch (err) {
        setError(err.message || 'Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  const showToast = (message) => {
    setToast({ message })
    window.setTimeout(() => setToast(null), 6000)
  }

  const handleEdit = () => {
    setIsEditing(true)
    if (userRole === 'donor' && pendingProfile) {
      setEditedData({
        ...profileData,
        name: pendingProfile.fullName ?? profileData.name,
        phone: pendingProfile.phone ?? profileData.phone,
        bloodType: pendingProfile.bloodType ?? profileData.bloodType,
        avatar: pendingProfile.profileImageUrl ?? profileData.avatar,
      })
    } else {
      setEditedData({ ...profileData })
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedData({ ...profileData })
  }

  const handleSave = async () => {
    try {
      setError('')
      const data = await apiRequest('/api/user/me', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editedData.name,
          phone: editedData.phone,
          bloodType: editedData.bloodType,
          profileImageUrl: editedData.avatar || null,
        }),
      })

      if (data.role === 'donor') {
        setPendingProfile(data.pending_profile || data.pendingProfile || null)
        showToast(
          'Your changes were submitted for admin approval. Your profile will update after they approve.',
        )
      } else {
        setProfileData({ ...editedData })
        if (avatarStorageKey) {
          if (editedData.avatar) {
            localStorage.setItem(avatarStorageKey, editedData.avatar)
          } else {
            localStorage.removeItem(avatarStorageKey)
          }
        }
      }

      setIsEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    }
  }

  const handleInputChange = (field, value) => {
    setEditedData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // In a real app, you would upload the file and get a URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditedData((prev) => ({ ...prev, avatar: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Top Header */}
      <header className="z-30 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 rounded-lg text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
            >
              <BrandLogo />
              <span>
                <span className="block text-lg font-bold tracking-tight text-slate-900">BloodConnect</span>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-red-700">
                  Profile
                </span>
              </span>
            </button>
          </div>

          {/* Right: User profile and notifications */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
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
                {notifications.some((n) => !n.is_read) && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="fixed top-16 right-0 left-0 z-50 mx-auto mt-2 w-[min(100%,calc(100vw-2rem))] max-w-sm rounded-xl bg-white shadow-lg ring-1 ring-slate-200 sm:absolute sm:inset-auto sm:right-0 sm:left-auto sm:mt-2 sm:w-80 sm:max-w-none">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                      <div className="rounded-lg px-3 py-2 text-sm text-slate-500">No new notifications</div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`mb-2 rounded-lg px-3 py-2 text-sm ${
                            notif.is_read ? 'bg-slate-50 text-slate-600' : 'bg-blue-50 text-blue-900'
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white ring-1 ring-red-700/20 transition hover:bg-red-700"
              >
                {profileData.avatar ? (
                  <img
                    src={profileData.avatar}
                    alt={profileData.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  profileData.name.charAt(0).toUpperCase()
                )}
              </button>
              <span className="hidden text-sm font-medium text-slate-700 sm:inline-block">
                {profileData.name}
              </span>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Profile Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information and account details
          </p>
        </div>

        {userRole === 'donor' && pendingProfile && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Profile update pending review</p>
            <p className="mt-1 text-amber-900/90">
              An administrator must approve your latest changes before they replace what is shown on your
              profile.
            </p>
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/90">
          <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Personal Information</h2>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 sm:min-h-0 sm:w-auto"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading profile...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
                  {/* Left: Avatar Section */}
                  <div className="flex flex-col items-center lg:items-start">
                    <div className="relative">
                      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-red-600 text-3xl font-semibold text-white shadow-lg ring-4 ring-white">
                        {(isEditing ? editedData : profileData).avatar ? (
                          <img
                            src={(isEditing ? editedData : profileData).avatar}
                            alt={profileData.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          profileData.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {isEditing && (
                        <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700">
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
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    {isEditing && (
                      <p className="mt-3 text-center text-xs text-slate-500 lg:text-left">
                        Click icon to change
                      </p>
                    )}
                  </div>

                  {/* Right: Form Fields */}
                  <div className="space-y-5">
                    {/* Username (read-only) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Username
                      </label>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {profileData.username || '—'}
                      </p>
                    </div>
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Full Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 sm:min-h-0 sm:py-2 sm:text-sm"
                          placeholder="Enter your full name"
                        />
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {profileData.name}
                        </p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Phone Number
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editedData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 sm:min-h-0 sm:py-2 sm:text-sm"
                          placeholder="Enter your phone number"
                        />
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {profileData.phone}
                        </p>
                      )}
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Email Address
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editedData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 sm:min-h-0 sm:py-2 sm:text-sm"
                          placeholder="Enter your email address"
                        />
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {profileData.email}
                        </p>
                      )}
                    </div>

                    {/* Blood Type */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Blood Type
                      </label>
                      {isEditing ? (
                        <select
                          value={editedData.bloodType}
                          onChange={(e) => handleInputChange('bloodType', e.target.value)}
                          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/20 sm:min-h-0 sm:py-2 sm:text-sm"
                        >
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      ) : (
                        <div className="mt-1">
                          <BloodTypeBadge type={profileData.bloodType} className="text-sm" />
                        </div>
                      )}
                    </div>

                    {/* Last Donation Date (read-only, if available) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Last Donation Date
                      </label>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {profileData.lastDonationDate
                          ? new Date(profileData.lastDonationDate).toLocaleDateString()
                          : 'No donations recorded yet'}
                      </p>
                    </div>
                  </div>
                </div>

                {isEditing && !isLoading && !error && (
                  <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:bottom-auto sm:top-4 sm:justify-end sm:px-6">
          <div
            className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-lg ring-1 ring-emerald-100"
            role="status"
          >
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 rounded p-1 text-emerald-700 transition hover:bg-emerald-100"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileSettings

