import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'

function Home() {
  const [activeRole, setActiveRole] = useState('donor') // 'donor' | 'hospital' | 'admin'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const roleForApi =
        activeRole === 'admin' ? 'admin' : activeRole === 'hospital' ? 'hospital' : 'donor'

      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
          role: roleForApi,
        }),
      })

      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.user.role)

      if (data.user.role === 'admin') {
        navigate('/admin/dashboard')
      } else if (data.user.role === 'hospital') {
        navigate('/hospital/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-red-150 via-white to-red-300">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-12 sm:px-6 lg:flex-row lg:gap-12 lg:px-8">
        {/* Left: Messaging */}
        <div className="w-full max-w-xl space-y-6 text-center lg:w-1/2 lg:text-left">

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Connecting Lives
            <span className="block text-red-600">Through Blood Donation</span>
          </h1>

          <p className="max-w-md text-sm text-slate-600 sm:text-base">
            BloodConnect links volunteer donors, patients, and accredited hospitals
            to ensure safe and rapid access to blood when every second counts.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-start">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              Donate Blood – Sign Up
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 lg:justify-start" />
        </div>

        {/* Right: Authentication Panel */}
        <div className="mt-10 w-full max-w-md lg:mt-0 lg:w-1/2">
          <div className="mx-auto rounded-2xl bg-white/90 p-6 shadow-xl shadow-red-100 ring-1 ring-red-100 backdrop-blur-sm sm:p-8">
            {/* Role Toggle */}
            <div className="mb-6 flex rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setActiveRole('donor')}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  activeRole === 'donor'
                    ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200'
                    : 'hover:text-red-600'
                }`}
              >
                Donor/Recipient
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('hospital')}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  activeRole === 'hospital'
                    ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200'
                    : 'hover:text-red-600'
                }`}
              >
                Hospital
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('admin')}
                className={`flex-1 rounded-full px-3 py-2 transition ${
                  activeRole === 'admin'
                    ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200'
                    : 'hover:text-red-600'
                }`}
              >
                Admin
              </button>
            </div>

            <div className="mb-6 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Login to BloodConnect</h2>
            </div>

            <form
              className="space-y-4"
              onSubmit={handleLogin}
            >
              <div className="space-y-1">
                <label
                  htmlFor="identifier"
                  className="block text-xs font-medium text-slate-700"
                >
                  Username or Email
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder="Enter your username or email"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Password
                  </label>
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700"
                >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </button>

              <p className="text-center text-xs text-slate-500">
                New to BloodConnect?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="cursor-pointer font-semibold text-red-600 hover:text-red-700"
                >
                  Create an account
                </button>
              </p>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
              Your information is encrypted and shared only with verified medical partners.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home