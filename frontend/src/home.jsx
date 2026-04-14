import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'
import { DashboardAnnouncementsPanel } from './AnnouncementFeed.jsx'
import { BrandLogo } from './BrandLogo.jsx'
import { useFeatureFlags } from './featureFlagsContext.jsx'

function Home() {
  const { isFlagEnabled } = useFeatureFlags()
  const [activeRole, setActiveRole] = useState('donor') // 'donor' | 'hospital' | 'admin'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [announcementsPanelOpen, setAnnouncementsPanelOpen] = useState(false)
  const googleButtonRef = useRef(null)

  const navigate = useNavigate()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const isGoogleRole = activeRole === 'donor'

  const openAnnouncementsPanel = useCallback(() => {
    setAnnouncementsPanelOpen(true)
    setMobileNavOpen(false)
  }, [])

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMobileNavOpen(false)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMobileNavOpen(false)
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  /** Nav "active" follows a viewport reading line — avoids highlighting Donate while still on the hero (large sections can intersect incorrectly with IntersectionObserver). */
  useEffect(() => {
    const updateActiveFromScroll = () => {
      const donate = document.getElementById('donate')
      const about = document.getElementById('about')
      if (!donate || !about) return

      const line = window.innerHeight * 0.22
      const donateRect = donate.getBoundingClientRect()
      const aboutRect = about.getBoundingClientRect()

      if (line < donateRect.top) {
        setActiveSection('')
        return
      }
      if (line >= aboutRect.top) {
        setActiveSection('about')
        return
      }
      setActiveSection('donate')
    }

    updateActiveFromScroll()
    window.addEventListener('scroll', updateActiveFromScroll, { passive: true })
    window.addEventListener('resize', updateActiveFromScroll)
    return () => {
      window.removeEventListener('scroll', updateActiveFromScroll)
      window.removeEventListener('resize', updateActiveFromScroll)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const roleForApi =
        activeRole === 'admin'
          ? 'admin'
          : activeRole === 'hospital'
            ? 'hospital'
            : 'donor'

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

      if (data.user.role === 'admin' || data.user.role === 'super_admin') {
        navigate('/admin/dashboard')
      } else if (data.user.role === 'hospital') {
        navigate('/hospital/inventory')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = useCallback(
    async (credential) => {
      try {
        setGoogleError('')
        setError('')

        const data = await apiRequest('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({
            credential,
            role: 'donor',
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
        setGoogleError(err.message || 'Google login failed')
      }
    },
    [navigate],
  )

  useEffect(() => {
    if (!isGoogleRole || !googleClientId) return
    if (!window.google?.accounts?.id || !googleButtonRef.current) return

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (!response?.credential) {
          setGoogleError('Google login failed. Please try again.')
          return
        }
        handleGoogleLogin(response.credential)
      },
    })

    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
      shape: 'pill',
    })
  }, [googleClientId, handleGoogleLogin, isGoogleRole])

  const navLinkClass = (id, options = {}) => {
    const { forceActive } = options
    const active = forceActive != null ? forceActive : activeSection === id
    return `rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-red-900 ${
      active
        ? 'bg-red-950/55 text-white underline decoration-white/90 decoration-2 underline-offset-4'
        : 'text-white/95 hover:bg-red-800/45 hover:text-white hover:underline hover:decoration-white/70 hover:underline-offset-4'
    }`
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-red-150 via-white to-red-300">
      {/* Sticky header */}
      <header className="z-50 border-b border-red-950/35 bg-red-900 shadow-md">
        <div className="mx-auto flex min-h-12 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:min-h-14 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex min-h-10 min-w-0 shrink-0 items-center gap-2 rounded-lg py-1 text-left text-white transition hover:bg-red-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <BrandLogo tone="hero" className="h-9 w-9 shrink-0 rounded-lg" roundedClass="rounded-lg" />
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-tight sm:text-base">BloodConnect</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-red-100 sm:block">
                Blood management
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {isFlagEnabled('public', 'public.nav_announcements') && (
              <button
                type="button"
                className={navLinkClass('announcements', {
                  forceActive: announcementsPanelOpen,
                })}
                onClick={openAnnouncementsPanel}
                aria-expanded={announcementsPanelOpen}
                aria-controls="announcements-side-panel"
              >
                Announcements
              </button>
            )}
            {isFlagEnabled('public', 'public.nav_donate') && (
              <button type="button" className={navLinkClass('donate')} onClick={() => scrollToSection('donate')}>
                Donate
              </button>
            )}
            {isFlagEnabled('public', 'public.nav_about') && (
              <button type="button" className={navLinkClass('about')} onClick={() => scrollToSection('about')}>
                About
              </button>
            )}
          </nav>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white hover:bg-red-800/50 md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="home-mobile-nav"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileNavOpen && (
          <div
            id="home-mobile-nav"
            className="border-t border-red-950/40 bg-red-950/98 px-4 py-3 shadow-inner md:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile primary">
              {isFlagEnabled('public', 'public.nav_announcements') && (
                <button
                  type="button"
                  className={`min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
                    announcementsPanelOpen ? 'bg-red-900/70 text-white' : 'text-white/95 hover:bg-red-800/45'
                  }`}
                  onClick={openAnnouncementsPanel}
                  aria-expanded={announcementsPanelOpen}
                >
                  Announcements
                </button>
              )}
              {isFlagEnabled('public', 'public.nav_donate') && (
                <button
                  type="button"
                  className={`min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
                    activeSection === 'donate' ? 'bg-red-900/70 text-white' : 'text-white/95 hover:bg-red-800/45'
                  }`}
                  onClick={() => scrollToSection('donate')}
                >
                  Donate
                </button>
              )}
              {isFlagEnabled('public', 'public.nav_about') && (
                <button
                  type="button"
                  className={`min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
                    activeSection === 'about' ? 'bg-red-900/70 text-white' : 'text-white/95 hover:bg-red-800/45'
                  }`}
                  onClick={() => scrollToSection('about')}
                >
                  About Us
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      <main>
        <div className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-6xl flex-col items-center justify-center px-4 py-10 sm:px-6 lg:flex-row lg:gap-12 lg:px-8 lg:py-12">
          {/* Left: Messaging */}
          <div className="w-full max-w-xl space-y-6 text-center lg:w-1/2 lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Connecting Lives
              <span className="block text-red-600">Through Blood Donation</span>
            </h1>

            <p className="mx-auto max-w-md text-sm text-slate-600 sm:text-base lg:mx-0">
            BloodConnect is a Blood Management System supporting the Red Cross by connecting donors and hospitals for fast, safe, and efficient blood supply, tracking, and distribution.
            </p>
          </div>

          {/* Right: Authentication Panel + announcements */}
          <div className="mt-10 flex w-full max-w-md flex-col gap-5 lg:mt-0 lg:w-1/2">
            <div className="mx-auto w-full rounded-2xl bg-white/90 p-6 shadow-xl shadow-red-100 ring-1 ring-red-100 backdrop-blur-sm sm:p-8">
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
                  Donor / Recipient
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

              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-1">
                  <label htmlFor="identifier" className="block text-xs font-medium text-slate-700">
                    Username or Email
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                    placeholder="Enter your username or email"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-medium text-slate-700">
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
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {error && <p className="text-xs font-medium text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  {isSubmitting ? 'Logging in...' : 'Login'}
                </button>

                {isGoogleRole && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">or</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    {!googleClientId ? (
                      <p className="text-xs text-amber-600">
                        Google login is unavailable. Set `VITE_GOOGLE_CLIENT_ID` in frontend env.
                      </p>
                    ) : (
                      <div className="flex justify-center">
                        <div ref={googleButtonRef} />
                      </div>
                    )}

                    {googleError && <p className="text-xs font-medium text-red-600">{googleError}</p>}
                  </>
                )}

                {isFlagEnabled('public', 'public.register') && (
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
                )}
              </form>

              <div className="mt-6 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
                Your information is encrypted and shared only with verified medical partners.
              </div>
            </div>
          </div>
        </div>

        {/* Donate */}
        {isFlagEnabled('public', 'public.section_donate') && (
          <section
            id="donate"
            className="scroll-mt-22 flex min-h-[65vh] flex-col justify-center border-t border-red-100/80 bg-white/90 py-28 shadow-sm sm:min-h-[72vh] sm:py-36 lg:min-h-[80vh] lg:py-44"
          >
            <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                Give blood, save lives
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-sm text-slate-600 sm:mt-8 sm:text-base lg:mt-10 lg:text-lg">
                Register as a donor to help hospitals maintain a safe blood supply. It only takes a few minutes to get
                started.
              </p>
              {isFlagEnabled('public', 'public.register') && (
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="mt-12 inline-flex min-h-12 items-center justify-center rounded-full bg-red-600 px-10 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 sm:mt-16"
                >
                  Start donating
                </button>
              )}
            </div>
          </section>
        )}

        {/* About */}
        {isFlagEnabled('public', 'public.section_about') && (
          <section
            id="about"
            className="scroll-mt-22 flex min-h-[65vh] flex-col justify-center border-t border-slate-200/80 bg-slate-50/90 py-28 sm:min-h-[72vh] sm:py-36 lg:min-h-[80vh] lg:py-44"
          >
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
              <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                About BloodConnect
              </h2>
              <p className="mt-8 text-sm leading-relaxed text-slate-600 sm:mt-10 sm:text-base lg:mt-12 lg:text-lg">
                BloodConnect is built for hospitals, donors, and administrators to coordinate blood requests, inventory,
                and donation activity in one place. Our goal is to reduce delays in emergencies and keep the community
                informed about drives and urgent needs—safely and transparently.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-slate-600 sm:mt-8 sm:text-base lg:mt-10 lg:text-lg">
                Whether you are logging in to donate, manage hospital supply, or oversee the network, BloodConnect keeps
                critical workflows clear and connected.
              </p>
            </div>
          </section>
        )}
      </main>

      {isFlagEnabled('public', 'public.nav_announcements') && (
        <DashboardAnnouncementsPanel
          open={announcementsPanelOpen}
          onClose={() => setAnnouncementsPanelOpen(false)}
        />
      )}
    </div>
  )
}

export default Home
