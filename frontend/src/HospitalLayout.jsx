import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'
import { useFeatureFlags } from './featureFlagsContext.jsx'

const HOSPITAL_SIDEBAR_HOVER_KEY = 'hospitalSidebarHovered'
const iconClassName = 'h-5 w-5 shrink-0'
const navIconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function InventoryNavIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M4 8h16v12H4V8Zm2-4h12l2 4H4l2-4Zm4 7v6m4-6v6" />
    </svg>
  )
}

function BloodRequestNavIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9h6m-6 4h6" />
    </svg>
  )
}

function TransactionNavIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function ReportsNavIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M4 20V9m5 11V4m5 16v-7m5 7V7" />
    </svg>
  )
}

const allHospitalSidebarItems = [
  { name: 'Inventory', path: '/hospital/inventory', icon: InventoryNavIcon, flagKey: 'hospital.inventory' },
  { name: 'Blood Request', path: '/hospital/blood-request', icon: BloodRequestNavIcon, flagKey: 'hospital.blood_request' },
  {
    name: 'Transaction History',
    path: '/hospital/transaction-history',
    icon: TransactionNavIcon,
    flagKey: 'hospital.transactions',
  },
  { name: 'Reports and Analytics', path: '/hospital/reports', icon: ReportsNavIcon, flagKey: 'hospital.reports' },
]

function NavLinks({ onNavigate, isExpanded, items }) {
  const location = useLocation()
  return (
    <nav className="space-y-1 text-sm" aria-label="Hospital portal sections">
      {items.map((item) => {
        const isActive = location.pathname === item.path
        const Icon = item.icon
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            title={!isExpanded ? item.name : undefined}
            className={`group flex min-h-[44px] w-full items-center rounded-xl px-3 py-3 text-left transition md:min-h-0 md:py-2.5 ${
              isExpanded ? 'gap-3' : 'justify-center'
            } ${
              isActive
                ? 'bg-red-500/20 font-medium text-white ring-1 ring-red-300/20'
                : 'text-slate-300 hover:bg-white/8 hover:text-white'
            }`}
          >
            <span
              className={isActive ? 'text-red-200' : 'text-slate-400 group-hover:text-slate-200'}
              aria-hidden="true"
            >
              <Icon />
            </span>
            <span
              className={`leading-snug whitespace-nowrap transition-all duration-200 ${
                isExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 overflow-hidden opacity-0'
              }`}
            >
              {item.name}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function HospitalLayout({ children, pageTitle, pageDescription }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isFlagEnabled } = useFeatureFlags()
  const sidebarItems = useMemo(() => {
    return allHospitalSidebarItems.filter((item) => isFlagEnabled('hospital', item.flagKey))
  }, [isFlagEnabled])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(HOSPITAL_SIDEBAR_HOVER_KEY) === 'true'
  })

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

  const handleSidebarMouseEnter = () => {
    setDesktopSidebarExpanded(true)
    localStorage.setItem(HOSPITAL_SIDEBAR_HOVER_KEY, 'true')
  }

  const handleSidebarMouseLeave = () => {
    setDesktopSidebarExpanded(false)
    localStorage.setItem(HOSPITAL_SIDEBAR_HOVER_KEY, 'false')
  }

  return (
    <div className="min-h-screen text-slate-900 antialiased">
      <a
        href="#hospital-main"
        className="fixed left-4 top-4 z-100 -translate-y-16 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-900/20 bg-[#151821] transition-[width] duration-200 md:flex ${
            desktopSidebarExpanded ? 'w-64' : 'w-20'
          }`}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          onFocus={handleSidebarMouseEnter}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) handleSidebarMouseLeave()
          }}
        >
          <div className="border-b border-white/10 px-5 py-5">
            <div className={`flex items-center ${desktopSidebarExpanded ? 'gap-3' : 'justify-center'}`}>
              <BrandLogo className="h-10 w-10 rounded-xl ring-1 ring-white/20" roundedClass="rounded-xl" />
              <div
                className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  desktopSidebarExpanded ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                <p className="text-sm font-semibold tracking-tight text-white">BloodConnect</p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-red-300">Hospital portal</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavLinks items={sidebarItems} isExpanded={desktopSidebarExpanded} />
          </div>
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={handleLogout}
              title={!desktopSidebarExpanded ? 'Log out' : undefined}
              className={`flex min-h-[44px] w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-red-500/20 hover:text-white ${
                desktopSidebarExpanded ? 'gap-3' : 'justify-center'
              }`}
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M15 17l5-5m0 0-5-5m5 5H9m6 5v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className={`whitespace-nowrap transition-all duration-200 ${
                  desktopSidebarExpanded ? 'max-w-[180px] opacity-100' : 'max-w-0 overflow-hidden opacity-0'
                }`}
              >
                Log out
              </span>
            </button>
          </div>
          <div className={`border-t border-white/10 px-5 py-4 ${desktopSidebarExpanded ? 'block' : 'hidden'}`}>
            <p className="text-[11px] leading-relaxed text-slate-300">
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
          className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,280px)] flex-col border-r border-slate-900/20 bg-[#151821] shadow-xl transition-transform duration-200 ease-out md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <BrandLogo className="h-9 w-9 rounded-lg" roundedClass="rounded-lg" />
              <span className="text-sm font-semibold text-white">BloodConnect</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <NavLinks items={sidebarItems} onNavigate={() => setMobileOpen(false)} isExpanded />
          </div>
          <div className="border-t border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-red-500/20 hover:text-white"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M15 17l5-5m0 0-5-5m5 5H9m6 5v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Log out</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="z-30 mx-3 mt-3 flex min-h-13 items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_8px_25px_-20px_rgba(15,23,42,0.45)] sm:mx-6 sm:mt-5 sm:gap-4 sm:px-6 sm:py-3 lg:mx-8">
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
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-700 sm:text-sm">
                  {pageDescription || 'Manage blood inventory and requests.'}
                </p>
              </div>
            </div>
          </header>

          <main
            id="hospital-main"
            className="min-w-0 flex-1 px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default HospitalLayout
