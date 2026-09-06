import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api.js'
import '../public-theme.css'

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
  const [googleError, setGoogleError] = useState('')
  const googleButtonRef = useRef(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

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
          role: 'recipient',
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

  const handleGoogleSignup = useCallback(
    async (credential) => {
      try {
        setGoogleError('')
        setError('')

        const data = await apiRequest('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({
            credential,
            role: 'recipient',
          }),
        })

        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.user.role)
        if (data.user.role === 'donor' && data.needsDonorProfileSetup) {
          navigate('/complete-google-donor-profile')
        } else {
          navigate('/dashboard')
        }
      } catch (err) {
        setGoogleError(err.message || 'Google signup failed')
      }
    },
    [navigate],
  )

  useEffect(() => {
    if (!googleClientId) return
    if (!window.google?.accounts?.id || !googleButtonRef.current) return

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (!response?.credential) {
          setGoogleError('Google signup failed. Please try again.')
          return
        }
        handleGoogleSignup(response.credential)
      },
    })

    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signup_with',
      shape: 'pill',
    })
  }, [googleClientId, handleGoogleSignup])

  return (
    <div className="bc-public-page min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-12 sm:px-6 lg:flex-row lg:gap-12 lg:px-8">
        {/* Left: Branding */}
        <div className="bc-register-intro w-full max-w-xl space-y-6 text-center lg:w-1/2 lg:text-left">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex min-h-10 items-center text-xs font-medium text-white/85 hover:text-white"
          >
            ← Back to login
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Join BloodConnect
            <span className="mt-3 block text-[#f3ccdc]">Register as Donor / Recipient</span>
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
            Create your BloodConnect account to receive notifications when your blood type
            is needed and track your donation history across partner hospitals.
          </p>
        </div>

        {/* Right: Registration Form */}
        <div className="mt-10 w-full max-w-md lg:mt-0 lg:w-1/2">
          <div className="mx-auto rounded-2xl bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-zinc-200 sm:p-8">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Create Account</h2>
            <p className="mb-4 text-xs text-zinc-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="font-semibold text-[#a52f49] hover:text-[#59102f]"
              >
                Login here
              </button>
            </p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
                  placeholder="Unique username for login"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Email <span className="text-zinc-400">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
                  placeholder="09xxxxxxxxx"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Blood Type
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
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
                <label className="block text-xs font-medium text-zinc-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:bg-white focus:border-[#a52f49] focus:ring-2 focus:ring-[#ead2dc]"
                  required
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-[#a52f49]">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-xs font-medium text-[#82203e]">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[#080808] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/10 transition hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a52f49] focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="flex items-center gap-2 pt-1">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">or</span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>

              {!googleClientId ? (
                <p className="text-xs text-amber-600">
                  Google signup is unavailable. Set `VITE_GOOGLE_CLIENT_ID` in frontend env.
                </p>
              ) : (
                <div className="flex justify-center">
                  <div ref={googleButtonRef} />
                </div>
              )}

              {googleError && <p className="text-xs font-medium text-[#a52f49]">{googleError}</p>}
            </form>

            <div className="mt-6 border-t border-zinc-100 pt-4 text-[11px] text-zinc-400">
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


