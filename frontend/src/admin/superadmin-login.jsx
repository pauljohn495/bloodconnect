import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api.js'
import { BrandLogo } from '../BrandLogo.jsx'

function SuperadminLogin() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          password,
          role: 'super_admin',
        }),
      })

      if (data.user.role !== 'super_admin') {
        setError('This account is not a super administrator.')
        return
      }

      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.user.role)
      navigate('/superadmin/feature-settings')
    } catch (err) {
      const msg = err?.message || 'Sign-in failed'
      if (msg === 'Failed to fetch' || err?.name === 'TypeError') {
        setError(
          'Cannot reach the API. Start the backend (port 3000), run the Vite dev server so /api is proxied, or set VITE_API_BASE_URL to your API URL.',
        )
      } else {
        setError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo className="h-12 w-12 rounded-xl ring-1 ring-white/15" roundedClass="rounded-xl" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Superadmin sign-in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Restricted access. Use your super administrator credentials only on this page.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-sm sm:p-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="superadmin-identifier" className="block text-xs font-medium text-slate-300">
                Username or email
              </label>
              <input
                id="superadmin-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2.5 text-sm text-white shadow-inner outline-none transition placeholder:text-slate-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/25"
                placeholder="Superadmin username or email"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="superadmin-password" className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <input
                id="superadmin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2.5 text-sm text-white shadow-inner outline-none transition placeholder:text-slate-500 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/25"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-xs font-medium text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
            <Link to="/" className="font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline">
              ← Back to BloodConnect home
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-600">
          Organization admins should use the main site &quot;Admin&quot; login, not this page.
        </p>
      </div>
    </div>
  )
}

export default SuperadminLogin
