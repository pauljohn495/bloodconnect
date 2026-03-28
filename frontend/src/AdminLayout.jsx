import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'

const sidebarItems = [
  { name: 'Dashboard', path: '/admin/dashboard' },
  { name: 'Requests', path: '/admin/requests' },
  { name: 'Inventory', path: '/admin/inventory' },
  { name: 'Donors / Organizations', path: '/admin/donations' },
  { name: 'Hospitals', path: '/admin/partners' },
  { name: 'Manage Users', path: '/admin/users' },
  { name: 'Reports & Analytics', path: '/admin/reports' },
  { name: 'Announcements', path: '/admin/announcements' },
]

function NavLinks({ onNavigate }) {
  const location = useLocation()
  return (
    <nav className="space-y-0.5 text-sm" aria-label="Admin sections">
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

function AdminLayout({ children, pageTitle, pageDescription }) {
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
        href="#admin-main"
        className="fixed left-4 top-4 z-100 -translate-y-16 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        {/* Tablet + desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white md:flex">
          <div className="border-b border-slate-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-10 w-10" />
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">BloodConnect</p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-red-700">
                  Admin console
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks />
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-[11px] leading-relaxed text-slate-500">
              Secure access to donor and hospital operations. Log out when finished on shared devices.
            </p>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <aside
          id="mobile-admin-nav"
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,280px)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div className="flex items-center gap-2">
              <BrandLogo className="h-9 w-9 rounded-lg" roundedClass="rounded-lg" />
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
                aria-controls="mobile-admin-nav"
              >
                <span className="sr-only">Open navigation menu</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-semibold leading-tight text-slate-900 sm:text-lg md:truncate">
                  {pageTitle || 'Dashboard overview'}
                </h1>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 sm:text-sm">
                  {pageDescription ||
                    'Monitor donors, requests, and hospital partners in real time.'}
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

          <main id="admin-main" className="min-w-0 flex-1 px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
