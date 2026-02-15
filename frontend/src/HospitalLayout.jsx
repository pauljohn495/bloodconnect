import { Link, useLocation, useNavigate } from 'react-router-dom'

const sidebarItems = [
  { name: 'Dashboard', path: '/hospital/dashboard' },
  { name: 'Inventory', path: '/hospital/inventory' },
  { name: 'Requests', path: '/hospital/requests' },
]

function HospitalLayout({ children, pageTitle, pageDescription }) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    // Clear authentication tokens and user data
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    // Navigate to home page
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Shell */}
      <div className="flex min-h-screen bg-red-50">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-6 shadow-sm lg:block">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white shadow-sm">
              BC
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">BloodConnect</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-red-600">
                Hospital Panel
              </p>
            </div>
          </div>

          <nav className="mt-8 space-y-1 text-sm ">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    isActive
                      ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span>{item.name}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  )}
                </Link>
              )
            })}
          </nav>

        </aside>

        {/* Main area */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <span className="sr-only">Toggle navigation</span>
                <span className="block h-0.5 w-4 rounded bg-slate-800" />
                <span className="mt-1 block h-0.5 w-3 rounded bg-slate-700" />
              </button>
              <div>
                <p className="text-sm font-semibold text-slate-900">BloodConnect Hospital</p>
                <p className="text-[11px] text-slate-500">{pageTitle || 'Overview & monitoring'}</p>
              </div>
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-slate-900">{pageTitle || 'Dashboard overview'}</p>
              <p className="text-[11px] text-slate-500">
                {pageDescription || 'Manage blood inventory and requests.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default HospitalLayout

