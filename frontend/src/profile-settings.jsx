import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function ProfileSettings() {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  // Sample data - replace with actual data from API/state
  const [profileData, setProfileData] = useState({
    name: 'Test',
    phone: '+1 (555) 123-4567',
    email: 'test@example.com',
    bloodType: 'O+',
    avatar: null,
  })

  const [editedData, setEditedData] = useState({ ...profileData })

  const handleEdit = () => {
    setIsEditing(true)
    setEditedData({ ...profileData })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedData({ ...profileData })
  }

  const handleSave = () => {
    setProfileData({ ...editedData })
    setIsEditing(false)
    // Here you would typically make an API call to save the data
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

  const handleLogout = () => {
    // Clear authentication tokens and user data
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    // Navigate to home page
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-red-50">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Left: Logo */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-xl font-bold text-red-600 transition hover:text-red-700"
            >
              BloodConnect
            </button>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white transition hover:bg-red-700"
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
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information and account details
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Two-column layout */}
            <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
              {/* Left: Avatar Section */}
              <div className="flex flex-col items-center lg:items-start">
                <div className="relative">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-red-600 text-3xl font-semibold text-white ring-4 ring-white shadow-lg">
                    {editedData.avatar ? (
                      <img
                        src={editedData.avatar}
                        alt={profileData.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      editedData.name.charAt(0).toUpperCase()
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
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
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
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
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
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {profileData.bloodType}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ProfileSettings

