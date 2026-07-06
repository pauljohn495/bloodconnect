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
    <div className="fixed inset-0 z-80 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close details" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(90vh,620px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200/50 sm:rounded-3xl">
        <div className="border-b border-slate-100 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200/50">
                {mbdTypeLabel(item.announcement_type)}
              </span>
              <h3 className="mt-3 text-lg font-bold text-slate-900 leading-snug">{item.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Description</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {item.description || 'No description provided.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Date Added</p>
              <p className="mt-1.5 text-xs font-bold text-slate-800">{formatMbdDate(item.created_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status</p>
              <p className="mt-1.5 text-xs font-bold text-slate-800">{mbdStatusLabel(item.status)}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Where</p>
            <p className="mt-1.5 text-xs font-bold text-slate-900">
              {item.location ? (
                <a
                  href={mapsUrl(item.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-red-600 underline decoration-red-200 underline-offset-2 transition hover:text-red-700"
                >
                  <span>{item.location}</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
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
  const images = Array.isArray(post.image_urls) ? post.image_urls : []
  const publishedDate = post.created_at ? new Date(post.created_at) : null
  const formattedDate = publishedDate
    ? publishedDate.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" style={{animation: 'fadeIn 0.18s ease'}}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close post" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[min(92vh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200/60 sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
      >
        {/* Drag handle on mobile */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0 flex-1">
            {formattedDate && (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-red-500">
                Published {formattedDate}
              </p>
            )}
            <h3 id="post-detail-title" className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              {post.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-5 space-y-5">
          {/* Images */}
          {images.length > 0 && (
            <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {images.map((url, idx) => (
                <div
                  key={idx}
                  className={`overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 ${
                    images.length === 1 ? 'aspect-video' : 'aspect-square'
                  }`}
                >
                  <img
                    src={url}
                    alt={`${post.title} — image ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Content</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {post.body || 'No content provided.'}
            </p>
          </div>
        </div>

        {/* Footer close button */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Home() {
  const { isFlagEnabled } = useFeatureFlags()
  const showMbdPublic = isFlagEnabled('public', 'public.section_mbd')
  const [activeRole, setActiveRole] = useState('donor') // 'donor' | 'hospital' | 'admin'
  const [donorLoginMode, setDonorLoginMode] = useState('identifier') // 'identifier' | 'id'
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
  const [scheduleView, setScheduleView] = useState('list') // 'list' | 'calendar'
  const googleButtonRef = useRef(null)

  const navigate = useNavigate()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const isGoogleRole = activeRole === 'donor'
  const isDonorIdLogin = activeRole === 'donor' && donorLoginMode === 'id'
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
        const data = await apiRequest('/api/home-posts?limit=6')
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
          identifier: identifier.trim(),
          password,
          role: roleForApi,
          loginMode: isDonorIdLogin ? 'id' : 'default',
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

  useEffect(() => {
    if (activeRole !== 'donor') {
      setDonorLoginMode('identifier')
    }
  }, [activeRole])

  const navLinkClass = (id, options = {}) => {
    const { forceActive } = options
    const active = forceActive != null ? forceActive : activeSection === id
    return `rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/80 ${
      active
        ? 'bg-red-50 text-red-600 font-bold shadow-sm border border-red-100/50'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Background glow graphics */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(239,68,68,0.08)_0%,rgba(248,250,252,0)_40%),radial-gradient(circle_at_85%_65%,rgba(244,63,94,0.06)_0%,rgba(248,250,252,0)_45%),linear-gradient(180deg,#f8fafc_0%,#f8fafc_100%)]"
      />
      <div className="relative z-10">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/50 bg-white/80 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex min-h-10 min-w-0 items-center gap-3 rounded-2xl px-3 py-1.5 text-left transition hover:bg-slate-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <BrandLogo tone="light" className="h-9 w-9 shrink-0 rounded-xl" roundedClass="rounded-xl" />
              <span className="leading-tight">
                <span className="block text-base font-extrabold tracking-tight text-slate-900">
                  Blood<span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">Connect</span>
                </span>
                <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">
                  Always first, always ready
                </span>
              </span>
            </button>

            <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
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
              <button
                type="button"
                className={navLinkClass('rankings', { forceActive: false })}
                onClick={() => navigate('/rankings')}
              >
                Rankings
              </button>
            </nav>

            <button
              type="button"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-expanded={mobileNavOpen}
              aria-controls="home-mobile-nav"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {mobileNavOpen && (
            <div id="home-mobile-nav" className="border-t border-slate-200/60 bg-white/95 px-4 py-3 shadow-inner md:hidden">
              <nav className="flex flex-col gap-1" aria-label="Mobile primary">
                {isFlagEnabled('public', 'public.nav_announcements') && (
                  <button
                    type="button"
                    className="min-h-10 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                    onClick={() => scrollToSection('login')}
                  >
                    Login
                  </button>
                )}
                {isFlagEnabled('public', 'public.nav_donate') && (
                  <button
                    type="button"
                    className={`min-h-10 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      activeSection === 'donate'
                        ? 'bg-red-50 text-red-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    onClick={() => scrollToSection('donate')}
                  >
                    Donate
                  </button>
                )}
                {isFlagEnabled('public', 'public.nav_about') && (
                  <button
                    type="button"
                    className={`min-h-10 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      activeSection === 'about'
                        ? 'bg-red-50 text-red-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    onClick={() => scrollToSection('about')}
                  >
                    About
                  </button>
                )}
                <button
                  type="button"
                  className="min-h-10 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => { setMobileNavOpen(false); navigate('/rankings') }}
                >
                  Rankings
                </button>
              </nav>
            </div>
          )}
        </header>

        <main className="pt-16">
          {/* Hero Section */}
          <section className="relative overflow-hidden pt-16 pb-16 lg:pt-24 lg:pb-24">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">


              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6.5xl leading-[1.1]">
                Empowering communities through{' '}
                <span className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 bg-clip-text text-transparent">
                  Smarter Blood Response
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                BloodConnect synchronizes donation campaigns, urgent hospital requests, and community volunteers so life-saving actions happen in seconds, not hours.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => scrollToSection('login')}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_-8px_rgba(220,38,38,0.5)] transition duration-300 hover:from-red-700 hover:to-rose-700 hover:-translate-y-0.5"
                >
                  Sign in to Portal
                </button>
                {isFlagEnabled('public', 'public.register') && (
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-700 shadow-sm transition duration-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Become a Donor
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Blood Donation Schedule — Full Width */}
          {showMbdPublic && (
            <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
              <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
                {/* Section Header */}
                <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Blood Donation Schedule</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Upcoming and active public donation drives near you</p>
                  </div>
                  {/* View Toggle */}
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setScheduleView('list')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition duration-200 ${
                        scheduleView === 'list'
                          ? 'bg-white text-red-600 shadow-sm ring-1 ring-slate-200/60'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleView('calendar')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition duration-200 ${
                        scheduleView === 'calendar'
                          ? 'bg-white text-red-600 shadow-sm ring-1 ring-slate-200/60'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Calendar
                    </button>
                  </div>
                </div>

                {/* Empty state */}
                {mbdItems.length === 0 && (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-400">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">No active donation events scheduled yet.</p>
                    <p className="mt-1 text-xs text-slate-400">Check back soon for upcoming drives in your area.</p>
                  </div>
                )}

                {/* LIST VIEW */}
                {scheduleView === 'list' && mbdItems.length > 0 && (
                  <ul className="divide-y divide-slate-100 px-6 py-4 space-y-0">
                    {mbdCalendarGroups.map((group) => (
                      <li key={group.key} className="py-5 first:pt-2">
                        <div className="grid grid-cols-[auto_1fr] gap-5">
                          {/* Date Badge */}
                          <div className="w-16 shrink-0 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-100/60 px-2 py-3 text-center shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
                              {group.date ? group.date.toLocaleDateString(undefined, { month: 'short' }) : 'Date'}
                            </p>
                            <p className="mt-0.5 text-2xl font-black leading-none text-slate-900">
                              {group.date ? String(group.date.getDate()).padStart(2, '0') : '--'}
                            </p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              {group.date ? group.date.toLocaleDateString(undefined, { weekday: 'short' }) : 'TBD'}
                            </p>
                          </div>
                          {/* Events */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {group.entries.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedMbd(item)}
                                className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-left transition duration-200 hover:border-red-200 hover:bg-red-50/50 hover:shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ring-1 ${
                                    item.announcement_type === 'urgent_need'
                                      ? 'bg-red-50 text-red-700 ring-red-200'
                                      : item.announcement_type === 'blood_drive'
                                      ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                      : 'bg-slate-50 text-slate-600 ring-slate-200'
                                  }`}>
                                    {mbdTypeLabel(item.announcement_type)}
                                  </span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                    item.status === 'ongoing' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                                  }`}>
                                    {mbdStatusLabel(item.status)}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm font-bold text-slate-900 leading-snug group-hover:text-red-700 transition">{item.title}</p>
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatMbdDate(item.event_starts_at)}
                                </div>
                                {item.location && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="truncate">{item.location}</span>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* CALENDAR VIEW */}
                {scheduleView === 'calendar' && mbdItems.length > 0 && (() => {
                  const now = new Date()
                  // Build a month range from the earliest to latest event
                  const allDates = mbdItems.map(i => parseMbdDate(i.event_starts_at)).filter(Boolean)
                  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : now
                  const viewMonth = minDate.getMonth()
                  const viewYear = minDate.getFullYear()
                  const firstDay = new Date(viewYear, viewMonth, 1)
                  const lastDay = new Date(viewYear, viewMonth + 1, 0)
                  const startOffset = firstDay.getDay() // 0=Sun
                  const daysInMonth = lastDay.getDate()

                  // Map day numbers to events
                  const eventsByDay = {}
                  mbdItems.forEach(item => {
                    const d = parseMbdDate(item.event_starts_at)
                    if (d && d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
                      const day = d.getDate()
                      if (!eventsByDay[day]) eventsByDay[day] = []
                      eventsByDay[day].push(item)
                    }
                  })

                  const cells = []
                  for (let i = 0; i < startOffset; i++) cells.push(null)
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

                  return (
                    <div className="px-6 py-5">
                      {/* Month label */}
                      <p className="mb-4 text-sm font-extrabold uppercase tracking-widest text-slate-700">
                        {firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </p>
                      {/* Day headers */}
                      <div className="mb-2 grid grid-cols-7 text-center">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                          <div key={d} className="py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{d}</div>
                        ))}
                      </div>
                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-1">
                        {cells.map((day, idx) => {
                          if (!day) return <div key={`empty-${idx}`} />
                          const evs = eventsByDay[day] || []
                          const isToday = now.getDate() === day && now.getMonth() === viewMonth && now.getFullYear() === viewYear
                          const hasEvent = evs.length > 0
                          return (
                            <div
                              key={day}
                              className={`relative min-h-[64px] rounded-xl border p-1.5 transition duration-200 ${
                                hasEvent
                                  ? 'border-red-200 bg-red-50/60 cursor-pointer hover:bg-red-100/60'
                                  : isToday
                                  ? 'border-slate-300 bg-slate-100'
                                  : 'border-slate-100 bg-white'
                              }`}
                            >
                              <span className={`text-xs font-bold ${
                                isToday ? 'text-red-600' : hasEvent ? 'text-red-700' : 'text-slate-500'
                              }`}>{day}</span>
                              {evs.map((ev, i) => (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={() => setSelectedMbd(ev)}
                                  className="mt-1 block w-full truncate rounded-md bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white text-left hover:bg-red-700 transition"
                                  title={ev.title}
                                >
                                  {ev.title}
                                </button>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                      {/* Events outside visible month */}
                      {mbdItems.some(item => {
                        const d = parseMbdDate(item.event_starts_at)
                        return d && (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear)
                      }) && (
                        <p className="mt-4 text-[11px] text-slate-400 text-center">
                          Some events fall outside this month view. Switch to List view to see all.
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            </section>
          )}

          {/* Latest Posts Section — up to 6 image-cover cards */}
          <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
              <div className="mb-7 text-center">
                <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-red-600 ring-1 ring-red-100">
                  Latest Updates
                </span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Recent Announcements &amp; Posts
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                  Stay informed with our most recent highlights and community updates.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {/* Filled post cards */}
                {homePosts.slice(0, 6).map((post) => {
                  const coverImage = Array.isArray(post.image_urls) && post.image_urls.length > 0
                    ? post.image_urls[0]
                    : null
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedPost(post)}
                      className="group relative flex aspect-[4/3] w-full overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-900 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/80"
                      aria-label={`Read post: ${post.title}`}
                    >
                      {/* Background image */}
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={post.title}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-red-800 via-red-700 to-rose-900" />
                      )}

                      {/* Gradient overlay for readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition duration-300 group-hover:from-black/90" />

                      {/* Corner badge */}
                      <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm ring-1 ring-white/25">
                        Post
                      </span>

                      {/* Title */}
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <p className="line-clamp-3 text-left text-sm font-bold leading-snug text-white drop-shadow-sm sm:text-base">
                          {post.title}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/70">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {post.created_at
                            ? new Date(post.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''}
                        </p>
                      </div>

                      {/* Read indicator */}
                      <div className="absolute right-4 bottom-4 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-white/20 text-white opacity-0 backdrop-blur-sm ring-1 ring-white/30 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  )
                })}

                {/* Placeholder slots when fewer than 6 posts */}
                {Array.from({ length: Math.max(0, 6 - homePosts.slice(0, 6).length) }).map((_, idx) => (
                  <div
                    key={`placeholder-${idx}`}
                    className="flex aspect-[4/3] items-center justify-center rounded-3xl border-2 border-dashed border-slate-200/70 bg-slate-50/80"
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[11px] font-semibold">Coming soon</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          {/* Blood Donation Benefits & Knowledge Cards */}
          <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <div className="mb-8 text-center">
              <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-red-600 ring-1 ring-red-100">
                Why Donate?
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Benefits of Blood Donation</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Every donation matters. Here's what you need to know.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
                  color: 'from-red-500 to-rose-500',
                  title: 'Save Up to 3 Lives',
                  body: 'A single blood donation can save up to three lives. Your blood is separated into red cells, plasma, and platelets — each used for different patients.',
                  tag: 'Impact'
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  color: 'from-orange-500 to-red-500',
                  title: 'Free Health Screening',
                  body: 'Before each donation, you receive a mini health check: blood pressure, pulse, hemoglobin, and temperature — all at no cost to you.',
                  tag: 'Health Benefit'
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                  color: 'from-rose-500 to-pink-500',
                  title: 'Reduces Heart Risk',
                  body: 'Regular donors may have lower risk of cardiovascular disease. Donating reduces iron levels in the blood, which can help protect arteries from damage.',
                  tag: 'Science'
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                  color: 'from-red-600 to-rose-600',
                  title: 'Donate Every 3 Months',
                  body: 'Healthy adults can donate whole blood every 56 days (about 3 months). Your body fully replenishes donated blood within 24–48 hours.',
                  tag: 'Know-How'
                },
                {
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></>,
                  color: 'from-red-500 to-red-600',
                  title: 'Blood Cannot Be Manufactured',
                  body: 'There is no artificial substitute for human blood. Hospitals rely entirely on volunteer donors to maintain supply for surgeries, emergencies, and treatments.',
                  tag: 'Did You Know'
                },
                {
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
                  color: 'from-rose-600 to-red-700',
                  title: 'Who Can Donate',
                  body: 'Most healthy adults aged 17–65 weighing at least 50kg can donate. You must not have donated in the last 3 months and be free of illness on donation day.',
                  tag: 'Eligibility'
                },
              ].map((card, idx) => (
                <div key={idx} className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm hover:shadow-md transition duration-300 hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)]`}>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {card.icon}
                      </svg>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-600 ring-1 ring-red-100">
                      {card.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Login Portal Section */}
          <section id="login" className="scroll-mt-24 border-y border-slate-200/60 bg-slate-50/50 py-16 sm:py-20">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
              {/* Left explanatory portal card */}
              <div className="relative overflow-hidden rounded-3xl border border-red-200/50 bg-gradient-to-br from-red-600 to-rose-600 p-8 flex flex-col justify-between shadow-xl">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:20px_20px]" />
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-200">Login Portal</p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
                    Every drop<br />connects a life.
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-red-100/90">
                    Join thousands of donors, hospitals, and volunteers working together to ensure no patient goes without blood.
                  </p>

                  <div className="mt-8 space-y-3">
                    {[
                      { icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />, title: 'Track your donation history', desc: 'See all your past donations and health records.' },
                      { icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />, title: 'Get urgent blood alerts', desc: 'Receive real-time notifications for nearby needs.' },
                      { icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />, title: 'Find upcoming drive events', desc: 'Locate blood drives near your area with ease.' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm ring-1 ring-white/20">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {item.icon}
                          </svg>
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">{item.title}</p>
                          <p className="mt-0.5 text-xs text-red-100/80">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative z-10 mt-8 border-t border-white/20 pt-5">
                  <p className="text-[10px] font-bold text-red-200/80 uppercase tracking-widest">BloodConnect — Always First, Always Ready</p>
                </div>
              </div>

              {/* Right Login form card */}
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/60 bg-white p-6 shadow-xl ring-1 ring-slate-100/50 sm:p-8 flex flex-col justify-center">
                {/* Sliding active role tabs indicator */}
                <div className="relative mb-8 flex rounded-2xl bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                  <div 
                    className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/50 transition-all duration-300 ease-out"
                    style={{
                      width: 'calc(33.33% - 4px)',
                      left: activeRole === 'donor' ? '4px' : activeRole === 'hospital' ? '33.33%' : '66.66%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveRole('donor')}
                    className={`relative z-10 flex-1 rounded-xl py-2.5 text-center transition duration-300 focus:outline-none ${
                      activeRole === 'donor' ? 'text-red-600 font-bold' : 'hover:text-red-600'
                    }`}
                  >
                    Donor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRole('hospital')}
                    className={`relative z-10 flex-1 rounded-xl py-2.5 text-center transition duration-300 focus:outline-none ${
                      activeRole === 'hospital' ? 'text-red-600 font-bold' : 'hover:text-red-600'
                    }`}
                  >
                    Hospital
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRole('admin')}
                    className={`relative z-10 flex-1 rounded-xl py-2.5 text-center transition duration-300 focus:outline-none ${
                      activeRole === 'admin' ? 'text-red-600 font-bold' : 'hover:text-red-600'
                    }`}
                  >
                    Admin
                  </button>
                </div>

                <h3 className="mb-6 text-lg font-bold text-slate-900">
                  Login as {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}
                </h3>

                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <label htmlFor="identifier" className="block text-xs font-bold text-slate-700">
                      {isDonorIdLogin ? 'Donor ID' : 'Username or Email'}
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition duration-200 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100/50"
                      placeholder={isDonorIdLogin ? 'Enter your donor ID (e.g., BC-12345)' : 'Enter your username or email'}
                      autoComplete={isDonorIdLogin ? 'off' : 'username'}
                    />
                  </div>

                  {!isDonorIdLogin && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="block text-xs font-bold text-slate-700">
                          Password
                        </label>
                        <button type="button" className="cursor-pointer text-xs font-semibold text-red-600 hover:text-red-700">
                          Forgot password?
                        </button>
                      </div>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition duration-200 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100/50"
                        placeholder="Enter your password"
                      />
                    </div>
                  )}

                  {activeRole === 'donor' && (
                    <button
                      type="button"
                      onClick={() => setDonorLoginMode((prev) => (prev === 'id' ? 'identifier' : 'id'))}
                      className="text-xs font-bold text-red-600 hover:text-red-700 transition"
                    >
                      {isDonorIdLogin ? 'Use Username/Email login instead' : 'Use Donor ID login instead'}
                    </button>
                  )}

                  {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200/50 rounded-xl p-2.5">{error}</p>}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] transition duration-200 hover:from-red-700 hover:to-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 hover:-translate-y-0.5 disabled:opacity-75 disabled:pointer-events-none"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Logging in...
                      </span>
                    ) : 'Login'}
                  </button>

                  {isGoogleRole && (
                    <>
                      <div className="flex items-center gap-3 pt-2">
                        <div className="h-px flex-1 bg-slate-200/80" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">or</span>
                        <div className="h-px flex-1 bg-slate-200/80" />
                      </div>

                      {!googleClientId ? (
                        <p className="text-center text-xs text-amber-600 bg-amber-50 rounded-xl p-2.5 border border-amber-200/50">
                          Google login is unavailable. Set `VITE_GOOGLE_CLIENT_ID` in environment.
                        </p>
                      ) : (
                        <div className="flex justify-center pt-2">
                          <div ref={googleButtonRef} className="w-full flex justify-center" />
                        </div>
                      )}

                      {googleError && <p className="text-center text-xs font-semibold text-red-600">{googleError}</p>}
                    </>
                  )}

                  {isFlagEnabled('public', 'public.register') && (
                    <p className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                      New to BloodConnect?{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="cursor-pointer font-bold text-red-600 hover:text-red-700 transition"
                      >
                        Create an account
                      </button>
                    </p>
                  )}
                </form>
              </div>
            </div>
          </section>

          {/* Donate Call-To-Action Banner */}
          {isFlagEnabled('public', 'public.section_donate') && (
            <section id="donate" className="scroll-mt-24 py-16 sm:py-20">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 to-rose-600 p-8 text-center shadow-xl sm:p-14">
                  {/* Subtle grid pattern background */}
                  <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:24px_24px]" />
                  <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

                  <div className="relative z-10">
                    <span className="inline-flex rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                      Join Our Network
                    </span>
                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                      Give blood, save lives.
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-sm text-red-50 sm:text-base leading-relaxed">
                      Register as an active donor, coordinate with emergency blood requests, and help local hospitals maintain safe reserve levels.
                    </p>
                    {isFlagEnabled('public', 'public.register') && (
                      <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-10 py-3.5 text-sm font-bold text-red-600 shadow-md transition duration-300 hover:bg-red-50 hover:-translate-y-0.5"
                      >
                        Register as a Donor
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* About & Mission Sections */}
          {isFlagEnabled('public', 'public.section_about') && (
            <section id="about" className="scroll-mt-24 py-16 sm:py-20 bg-slate-50/50 border-t border-slate-200/50">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm lg:col-span-7 flex flex-col justify-center">
                    <p className="text-xs font-black uppercase tracking-widest text-red-600">Our Platform</p>
                    <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">About BloodConnect</h2>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                      BloodConnect is a coordinated digital platform engineered to bridge the communication gaps in public health logistics. We connect donors, hospital networks, and community managers through transparent logs and real-time alerts.
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                      By removing friction from the response pipeline, our platform drastically reduces delays during emergency requests and simplifies the scheduling of mobile blood drive activities.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm lg:col-span-5 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-red-600">Core Values</p>
                      <h3 className="mt-3 text-lg font-bold text-slate-900">What we build for</h3>
                    </div>

                    <ul className="mt-6 space-y-4">
                      {[
                        { title: 'Rapid Mobilization', desc: 'Urgent requests broadcast directly to matching donors.', icon: (
                          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )},
                        { title: 'Validated Inventory', desc: 'Hospital stocks verified by real-time transactions.', icon: (
                          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        )},
                        { title: 'Community Synergy', desc: 'Encouraging drives with calendar highlights and updates.', icon: (
                          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        )},
                      ].map((value, idx) => (
                        <li key={idx} className="flex gap-3.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 shadow-sm border border-red-100/50">
                            {value.icon}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{value.title}</h4>
                            <p className="text-xs text-slate-500 leading-normal">{value.desc}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Slogan Banner */}
          <section className="relative overflow-hidden bg-slate-900 py-16 sm:py-20 text-center">
            {/* Ambient light effects inside the dark banner */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(220,38,38,0.25)_0%,rgba(15,23,42,0)_60%)]" />
            <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500 sm:text-sm">
                Volunteers • Logistics • Information Technology
              </p>
              <h2 className="mt-4 text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
                Always First, Always Ready, Always There
              </h2>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white py-12 text-slate-700">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1.5fr_1fr] lg:px-8">
              <div className="space-y-3">
                <p className="text-base font-extrabold tracking-tight text-slate-950">
                  Blood<span className="text-red-600">Connect</span>
                </p>
                <p className="text-sm leading-relaxed text-slate-500">
                  A coordinated platform designed to simplify donor drives, automate hospital supply inventory, and optimize life-saving logistics.
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Navigation</p>
                <div className="mt-4 space-y-2.5 text-sm">
                  <button type="button" onClick={() => scrollToSection('login')} className="block text-slate-500 hover:text-red-600 font-semibold transition text-left">
                    Login Portal
                  </button>
                  <button type="button" onClick={() => scrollToSection('donate')} className="block text-slate-500 hover:text-red-600 font-semibold transition text-left">
                    Donate Now
                  </button>
                  <button type="button" onClick={() => scrollToSection('about')} className="block text-slate-500 hover:text-red-600 font-semibold transition text-left">
                    About Platform
                  </button>
                </div>
              </div>
            </div>
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-100 text-center text-xs text-slate-400 font-semibold">
              &copy; {new Date().getFullYear()} BloodConnect Platform. All rights reserved.
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
