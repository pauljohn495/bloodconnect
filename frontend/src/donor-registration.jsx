import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'

function DonorRegistration() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      await apiRequest('/api/auth/register-donor', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          username,
          email,
          password,
          phone,
          bloodType,
        }),
      })

      setSuccess('Account created successfully. You can now log in.')

      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-red-100 via-white to-red-200">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-12 sm:px-6 lg:flex-row lg:gap-12 lg:px-8">
        {/* Left: Branding */}
        <div className="w-full max-w-xl space-y-6 text-center lg:w-1/2 lg:text-left">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-red-600"
          >
            ← Back to login
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Join BloodConnect
            <span className="block text-red-600">Register as a Donor</span>
          </h1>

          <p className="max-w-md text-sm text-slate-600 sm:text-base">
            Create your BloodConnect account to receive notifications when your blood type
            is needed and track your donation history across partner hospitals.
          </p>
        </div>

        {/* Right: Registration Form */}
        <div className="mt-10 w-full max-w-md lg:mt-0 lg:w-1/2">
          <div className="mx-auto rounded-2xl bg-white/95 p-6 shadow-xl shadow-red-100 ring-1 ring-red-100 backdrop-blur-sm sm:p-8">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Create Donor Account</h2>
            <p className="mb-4 text-xs text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="font-semibold text-red-600 hover:text-red-700"
              >
                Login here
              </button>
            </p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder="Unique username for login"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Email <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder="09xxxxxxxxx"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
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
                <label className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  required
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-xs font-medium text-emerald-600">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
              By creating an account, you consent to be contacted by BloodConnect and
              partner hospitals when there is an urgent need that matches your blood type.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DonorRegistration


