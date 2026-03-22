import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const sidebarItems = [
  { name: 'Inventory', path: '/hospital/inventory' },
  { name: 'Requests', path: '/hospital/requests' },
  { name: 'Reports and Analytics', path: '/hospital/reports' },
]

function NavLinks({ onNavigate }) {
  const location = useLocation()
  return (
    <nav className="space-y-0.5 text-sm" aria-label="Hospital portal sections">
      {sidebarItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`group flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition md:min-h-0 md:py-2.5 ${
              isActive
                ? 'bg-red-50 font-medium text-red-900 ring-1 ring-red-100/80'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                isActive ? 'bg-red-600' : 'bg-slate-300 group-hover:bg-slate-400'
              }`}
              aria-hidden="true"
            />
            <span className="leading-snug">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function HospitalLayout({ children, pageTitle, pageDescription }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-slate-900 antialiased">
      <a
        href="#hospital-main"
        className="fixed left-4 top-4 z-100 -translate-y-16 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white md:flex">
          <div className="border-b border-slate-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm ring-1 ring-red-700/20">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18M6 12h4M6 16h4M6 8h4m4 8h4m-4-4h4m-4-4h4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">BloodConnect</p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-red-700">
                  Hospital portal
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks />
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-[11px] leading-relaxed text-slate-500">
              View stock, request blood, and monitor expiry. Sign out on shared workstations when finished.
            </p>
          </div>
        </aside>

        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          id="mobile-hospital-nav"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,280px)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path
                    d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18M6 12h4M6 16h4M6 8h4m4 8h4m-4-4h4m-4-4h4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-900">BloodConnect</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-[3.25rem] items-center justify-between gap-3 border-b border-slate-200/90 bg-white/90 px-3 py-2.5 backdrop-blur-md sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 md:hidden"
                aria-expanded={mobileOpen}
                aria-controls="mobile-hospital-nav"
              >
                <span className="sr-only">Open navigation menu</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-semibold leading-tight text-slate-900 sm:text-lg md:truncate">
                  {pageTitle || 'Hospital overview'}
                </h1>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 sm:text-sm">
                  {pageDescription || 'Manage blood inventory and requests.'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                Log out
              </button>
            </div>
          </header>

          <main id="hospital-main" className="min-w-0 flex-1 px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default HospitalLayout
