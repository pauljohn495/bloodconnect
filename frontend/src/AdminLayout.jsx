import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'
import { useFeatureFlags } from './featureFlagsContext.jsx'

const ADMIN_SIDEBAR_HOVER_KEY = 'adminSidebarHovered'
const iconClassName = 'h-5 w-5 shrink-0'
const navIconStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function DashboardIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M3 13h8V3H3v10Zm10 8h8v-6h-8v6Zm0-10h8V3h-8v8ZM3 21h8v-4H3v4Z" />
    </svg>
  )
}

function RequestsIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M7 3h10l4 4v14H3V3h4Zm3 6h7M7 13h10M7 17h6" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M4 8h16v12H4V8Zm2-4h12l2 4H4l2-4Zm4 7v6m4-6v6" />
    </svg>
  )
}

function DonorsIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m19 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" />
      <circle cx="8.5" cy="7" r="4" {...navIconStroke} />
    </svg>
  )
}

function HospitalIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M4 21V7l8-4 8 4v14H4Zm6-12v8m4-8v8m-6-4h8" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" {...navIconStroke} />
      <path {...navIconStroke} d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M4 20V9m5 11V4m5 16v-7m5 7V7" />
    </svg>
  )
}

function AnnouncementsIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path {...navIconStroke} d="M3 11.5V8a2 2 0 0 1 2-2h2l9-3v18l-9-3H5a2 2 0 0 1-2-2v-3.5Zm5.5 6.5 1.5 3" />
    </svg>
  )
}

function MbdIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path
        {...navIconStroke}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
      <path
        {...navIconStroke}
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-1.42 3.42 2 2 0 0 1-1.42-.58l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.84-2.84l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.84-2.84l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.84 2.84l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .68.41 1.29 1.04 1.55.21.09.44.14.67.15H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  )
}

/** Superadmin sidebar: only these two destinations. */
const superAdminSidebarItems = [
  { name: 'Module visibility', path: '/superadmin/feature-settings', icon: SettingsIcon, flagKey: null },
  { name: 'Manage Users', path: '/admin/users', icon: UsersIcon, flagKey: 'admin.users' },
  { name: 'MBD', path: '/admin/mbd', icon: MbdIcon, flagKey: 'admin.mbd' },
]

const allSidebarItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: DashboardIcon, flagKey: 'admin.dashboard' },
  { name: 'Requests', path: '/admin/requests', icon: RequestsIcon, flagKey: 'admin.requests' },
  { name: 'Inventory', path: '/admin/inventory', icon: InventoryIcon, flagKey: 'admin.inventory' },
  { name: 'Donors / Organizations', path: '/admin/donations', icon: DonorsIcon, flagKey: 'admin.donations' },
  { name: 'Hospitals', path: '/admin/partners', icon: HospitalIcon, flagKey: 'admin.partners' },
  { name: 'Manage Users', path: '/admin/users', icon: UsersIcon, flagKey: 'admin.users' },
  { name: 'Reports & Analytics', path: '/admin/reports', icon: ReportsIcon, flagKey: 'admin.reports' },
  { name: 'Announcements', path: '/admin/announcements', icon: AnnouncementsIcon, flagKey: 'admin.announcements' },
  { name: 'MBD', path: '/admin/mbd', icon: MbdIcon, flagKey: 'admin.mbd' },
]

function NavLinks({ onNavigate, isExpanded, items }) {
  const location = useLocation()
  return (
    <nav className="space-y-1 text-sm" aria-label="Admin sections">
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
            <span className={isActive ? 'text-red-200' : 'text-slate-400 group-hover:text-slate-200'} aria-hidden="true">
              <Icon />
            </span>
            <span
              className={`leading-snug whitespace-nowrap transition-all duration-200 ${
                isExpanded ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0 overflow-hidden'
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

function AdminLayout({ children, pageTitle, pageDescription }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isFlagEnabled } = useFeatureFlags()
  const role = typeof localStorage !== 'undefined' ? localStorage.getItem('role') : null
  const sidebarItems = useMemo(() => {
    if (role === 'super_admin') {
      return superAdminSidebarItems.filter((item) => {
        if (!item.flagKey) return true
        return isFlagEnabled('admin', item.flagKey)
      })
    }
    return allSidebarItems.filter((item) => {
      if (!item.flagKey) return true
      return isFlagEnabled('admin', item.flagKey)
    })
  }, [isFlagEnabled, role])
  const isSuperAdmin = role === 'super_admin'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(ADMIN_SIDEBAR_HOVER_KEY) === 'true'
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
    localStorage.setItem(ADMIN_SIDEBAR_HOVER_KEY, 'true')
  }

  const handleSidebarMouseLeave = () => {
    setDesktopSidebarExpanded(false)
    localStorage.setItem(ADMIN_SIDEBAR_HOVER_KEY, 'false')
  }

  return (
    <div className="min-h-screen text-slate-900 antialiased">
      <a
        href="#admin-main"
        className="fixed left-4 top-4 z-100 -translate-y-16 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <div className="flex min-h-screen">
        <>
            {/* Tablet + desktop sidebar */}
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
                    <p className="text-[11px] font-medium uppercase tracking-wider text-red-300">
                      {isSuperAdmin ? 'Superadmin' : 'Admin console'}
                    </p>
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
        </>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="z-30 mx-3 mt-3 flex min-h-13 items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_8px_25px_-20px_rgba(15,23,42,0.45)] sm:mx-6 sm:mt-5 sm:gap-4 sm:px-6 sm:py-3 lg:mx-8">
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
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-700 sm:text-sm">
                  {pageDescription ||
                    'Monitor donors, requests, and hospital partners in real time.'}
                </p>
              </div>
            </div>
          </header>

          <main
            id="admin-main"
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

export default AdminLayout
