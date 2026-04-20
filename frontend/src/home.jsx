import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'
import { BrandLogo } from './BrandLogo.jsx'
import { useFeatureFlags } from './featureFlagsContext.jsx'

function formatMbdDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function mbdTypeLabel(type) {
  if (type === 'general') return 'General'
  if (type === 'urgent_need') return 'Urgent Need'
  if (type === 'blood_drive') return 'Blood Drive'
  return 'General'
}

function mbdStatusLabel(status) {
  if (status === 'upcoming') return 'Upcoming'
  if (status === 'ongoing') return 'Ongoing'
  if (status === 'completed') return 'Completed'
  return 'Upcoming'
}

function mapsUrl(location) {
  if (!location) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

function parseMbdDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function MbdDetailModal({ item, onClose }) {
  if (!item) return null
  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close details" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(90vh,620px)] w-full max-w-md flex-col overflow-hidden rounded-t-[1.35rem] bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-red-200">
                {mbdTypeLabel(item.announcement_type)}
              </span>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {item.description || 'No description provided.'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date & time added</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatMbdDate(item.created_at)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Where</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {item.location ? (
                <a
                  href={mapsUrl(item.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-700 underline decoration-red-200 underline-offset-2 transition hover:text-red-800"
                >
                  {item.location}
                </a>
              ) : (
                'Not specified'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PostDetailModal({ post, onClose }) {
  if (!post) return null
  return (
    <div className="fixed inset-0 z-85 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close details" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(90vh,620px)] w-full max-w-md flex-col overflow-hidden rounded-t-[1.35rem] bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{post.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{post.body}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Home() {
  const { isFlagEnabled } = useFeatureFlags()
  const showMbdPublic = isFlagEnabled('public', 'public.section_mbd')
  const [activeRole, setActiveRole] = useState('donor') // 'donor' | 'hospital' | 'admin'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [homePosts, setHomePosts] = useState([])
  const [mbdItems, setMbdItems] = useState([])
  const [selectedMbd, setSelectedMbd] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const googleButtonRef = useRef(null)

  const navigate = useNavigate()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const isGoogleRole = activeRole === 'donor'
  const getHeaderOffset = useCallback(() => {
    const headerEl = document.querySelector('header')
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0
    return headerHeight + 12
  }, [])

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - getHeaderOffset()
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
    setMobileNavOpen(false)
  }, [getHeaderOffset])

  const scrollToTop = useCallback(() => {
    const top = Math.max(0, 0 + getHeaderOffset())
    window.scrollTo({ top, behavior: 'smooth' })
    setMobileNavOpen(false)
  }, [getHeaderOffset])

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

  const mbdCalendarGroups = useMemo(() => {
    const grouped = new Map()

    mbdItems.forEach((item) => {
      const parsed = parseMbdDate(item.event_starts_at)
      const key = parsed
        ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
        : 'unknown-date'

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          date: parsed,
          entries: [],
        })
      }

      grouped.get(key).entries.push(item)
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.getTime() - b.date.getTime()
    })
  }, [mbdItems])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiRequest('/api/home-posts')
        if (!cancelled) setHomePosts(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setHomePosts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showMbdPublic) {
      setMbdItems([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({
          limit: '10',
          activeOnly: 'true',
          sort: 'nearest',
        })
        const data = await apiRequest(`/api/announcements?${params.toString()}`)
        if (!cancelled) setMbdItems(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setMbdItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showMbdPublic])

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
    return `rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-red-800 ${
      active
        ? 'bg-white text-red-700 shadow-sm'
        : 'text-white/95 hover:bg-red-800/70 hover:text-white'
    }`
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_-8%,rgba(254,202,202,0.35)_0%,rgba(248,250,252,0)_38%),radial-gradient(circle_at_95%_15%,rgba(252,165,165,0.2)_0%,rgba(248,250,252,0)_42%),linear-gradient(180deg,#f8fafc_0%,#f8fafc_100%)]"
      />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-red-950/30 bg-red-900/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex min-h-10 min-w-0 items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-red-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <BrandLogo tone="hero" className="h-9 w-9 shrink-0 rounded-lg" roundedClass="rounded-lg" />
              <span className="leading-tight">
                <span className="block text-sm font-bold tracking-tight text-white sm:text-base">BloodConnect</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-red-100/85 sm:block">
                  Always first, always ready
                </span>
              </span>
            </button>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {isFlagEnabled('public', 'public.nav_announcements') && (
                <button
                  type="button"
                  className={navLinkClass('announcements', { forceActive: false })}
                  onClick={() => scrollToSection('login')}
                >
                  Login
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white transition hover:bg-red-800/70 md:hidden"
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
            <div id="home-mobile-nav" className="border-t border-red-950/30 bg-red-900/98 px-4 py-3 shadow-inner md:hidden">
              <nav className="flex flex-col gap-1" aria-label="Mobile primary">
                {isFlagEnabled('public', 'public.nav_announcements') && (
                  <button
                    type="button"
                    className="min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-red-800/70"
                    onClick={() => scrollToSection('login')}
                  >
                    Login
                  </button>
                )}
                {isFlagEnabled('public', 'public.nav_donate') && (
                  <button
                    type="button"
                    className={`min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
                      activeSection === 'donate'
                        ? 'bg-white text-red-700 ring-1 ring-white/80'
                        : 'text-white hover:bg-red-800/70'
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
                      activeSection === 'about'
                        ? 'bg-white text-red-700 ring-1 ring-white/80'
                        : 'text-white hover:bg-red-800/70'
                    }`}
                    onClick={() => scrollToSection('about')}
                  >
                    About
                  </button>
                )}
              </nav>
            </div>
          )}
        </header>

        <main>
          <section className="mx-auto w-full max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8 lg:pt-10">
            <div className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="border-b border-slate-200/80 bg-white p-7 sm:p-9 lg:border-r lg:border-b-0">
                  <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700 ring-1 ring-red-100">
                    Public Dashboard
                  </span>
                  <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    Modern blood response for donors, hospitals, and administrators.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                    BloodConnect keeps campaigns, requests, and community updates synchronized so life-saving decisions happen faster.
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection('login')}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-900/10 transition hover:bg-red-700"
                    >
                      Login
                    </button>
                    {isFlagEnabled('public', 'public.register') && (
                      <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        Create Account
                      </button>
                    )}
                  </div>
                </div>

                <aside className="bg-slate-50/70 p-6 sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-600">System snapshot</p>
                  <div className={`mt-4 grid gap-3 ${showMbdPublic ? 'sm:grid-cols-2 lg:grid-cols-1' : 'grid-cols-1'}`}>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Announcements</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{homePosts.length}</p>
                    </div>
                    {showMbdPublic && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active schedules</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{mbdItems.length}</p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className={`grid grid-cols-1 gap-6 ${showMbdPublic ? 'xl:grid-cols-2' : ''}`}>
              {showMbdPublic && (
                <div className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-slate-900">Blood Donation Schedule</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Upcoming and active public drives</p>
                    </div>
                  </div>

                  <ul className="max-h-[440px] space-y-3 overflow-y-auto bg-white p-4 sm:p-5">
                    {mbdItems.length === 0 && (
                      <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                        No active MBD yet.
                      </li>
                    )}
                    {mbdCalendarGroups.map((group) => (
                      <li key={group.key} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                        <div className="grid grid-cols-[auto_1fr] gap-3">
                          <div className="w-16 rounded-xl border border-red-200 bg-white px-2 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                              {group.date ? group.date.toLocaleDateString(undefined, { month: 'short' }) : 'Date'}
                            </p>
                            <p className="mt-0.5 text-xl font-extrabold leading-none text-red-800">
                              {group.date ? String(group.date.getDate()).padStart(2, '0') : '--'}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-600/90">
                              {group.date ? group.date.toLocaleDateString(undefined, { weekday: 'short' }) : 'TBD'}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {group.entries.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedMbd(item)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-red-300 hover:bg-red-50"
                              >
                                <p className="text-[11px] font-black uppercase tracking-wide text-red-700">
                                  {mbdTypeLabel(item.announcement_type)} • {mbdStatusLabel(item.status)}
                                </p>
                                <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatMbdDate(item.event_starts_at)}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-slate-900">Announcements</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Latest updates</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                    Public
                  </span>
                </div>

                <div className="max-h-[440px] space-y-3 overflow-y-auto bg-white p-4 sm:p-5">
                  {homePosts.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                      No published posts yet.
                    </p>
                  )}
                  {homePosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedPost(post)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-left transition hover:border-red-300 hover:bg-red-50/70"
                    >
                      <h3 className="text-sm font-semibold text-slate-900">{post.title}</h3>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m4-4H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Emergency response ready</h3>
              <p className="mt-2 text-sm text-slate-600">Coordinate urgent blood requests quickly through one synchronized workflow.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Reliable tracking</h3>
              <p className="mt-2 text-sm text-slate-600">Monitor schedules, announcements, and status changes with transparent records.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Secure role access</h3>
              <p className="mt-2 text-sm text-slate-600">Built for donors, hospitals, and administrators with role-based entry points.</p>
            </div>
          </section>

          <section id="login" className="scroll-mt-24 border-y border-slate-200 bg-white py-16">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Login portal</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  Every drop connects a life.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Continue to your dashboard and support faster blood response, campaign visibility, and hospital readiness.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Donors and recipients access personal dashboard tools.
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Hospital teams manage inventory and requests in real time.
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Administrators coordinate the full network.
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80 sm:p-8">
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
                    Donor
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

                <h3 className="mb-6 text-lg font-semibold text-slate-900">Login to BloodConnect</h3>

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
                      className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                      placeholder="Enter your username or email"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                        Password
                      </label>
                      <button type="button" className="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700">
                        Forgot password?
                      </button>
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  {error && <p className="text-xs font-medium text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-900/10 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
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
              </div>
            </div>
          </section>

          {isFlagEnabled('public', 'public.section_donate') && (
            <section id="donate" className="scroll-mt-24 border-b border-slate-200 py-18 sm:py-20">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-red-200 bg-red-50/80 p-8 text-center sm:p-12">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Give blood, save lives.</h2>
                  <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-600 sm:text-base">
                    Register as a donor and help hospitals maintain safe and reliable blood supply for urgent cases.
                  </p>
                  {isFlagEnabled('public', 'public.register') && (
                    <button
                      type="button"
                      onClick={() => navigate('/register')}
                      className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-red-600 px-10 py-3 text-sm font-semibold text-white shadow-sm shadow-red-900/10 transition hover:bg-red-700"
                    >
                      Start donating
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {isFlagEnabled('public', 'public.section_about') && (
            <section id="about" className="scroll-mt-24 py-18 sm:py-20">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">About BloodConnect</h2>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                      BloodConnect helps hospitals, donors, and administrators coordinate requests, inventory, and campaigns from one platform.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                      The goal is clear: reduce delays during emergencies and keep workflows transparent for every participant.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700">Mission values</p>
                    <ul className="mt-4 space-y-3 text-sm text-slate-700">
                      <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        Fast mobilization for urgent blood requests.
                      </li>
                      <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        Reliable information flow for donors and institutions.
                      </li>
                      <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        Connected teams focused on better patient outcomes.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="border-y border-red-200 bg-red-700 py-14">
            <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6 lg:px-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-red-100 sm:text-lg">
                Volunteers + Logistics + Information Technology
              </p>
              <p className="mt-3 text-2xl font-extrabold uppercase tracking-[0.07em] text-white sm:text-4xl lg:text-5xl">
                Always First, Always Ready, Always There
              </p>
            </div>
          </section>

          <footer className="border-t border-slate-200 bg-white py-10 text-slate-700">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-7 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
              <div>
                <p className="text-sm font-semibold text-slate-900">BloodConnect</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  A coordinated platform for blood donation campaigns, requests, and life-saving response.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Navigation</p>
                <div className="mt-3 space-y-2 text-sm">
                  <button type="button" onClick={() => scrollToSection('login')} className="block hover:text-red-700">
                    Login
                  </button>
                  <button type="button" onClick={() => scrollToSection('donate')} className="block hover:text-red-700">
                    Donate
                  </button>
                  <button type="button" onClick={() => scrollToSection('about')} className="block hover:text-red-700">
                    About
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Status</p>
                {showMbdPublic && (
                  <p className="mt-3 text-sm text-slate-600">
                    Active MBD: <span className="font-semibold text-slate-900">{mbdItems.length}</span>
                  </p>
                )}
                <p className={`text-sm text-slate-600 ${showMbdPublic ? 'mt-1' : 'mt-3'}`}>
                  Announcements: <span className="font-semibold text-slate-900">{homePosts.length}</span>
                </p>
              </div>
            </div>
          </footer>
        </main>

        {showMbdPublic && selectedMbd && <MbdDetailModal item={selectedMbd} onClose={() => setSelectedMbd(null)} />}
        {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />}
      </div>
    </div>
  )
}

export default Home
