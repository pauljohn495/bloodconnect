import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api.js'

function GoogleDonorProfileSetup() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const data = await apiRequest('/api/auth/complete-google-donor-profile', {
        method: 'POST',
        body: JSON.stringify({
          username,
          bloodType,
          phone,
        }),
      })

      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.user.role)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Failed to complete profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-red-100 via-white to-red-200">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-xl shadow-red-100 ring-1 ring-red-100 backdrop-blur-sm sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Complete your donor profile</h1>
          <p className="mt-1 text-xs text-slate-500">
            Please finish these details before entering your dashboard.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                placeholder="Choose your username"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Blood Type</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
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

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Contact Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                placeholder="09xxxxxxxxx"
                required
              />
            </div>

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Continue to dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default GoogleDonorProfileSetup
