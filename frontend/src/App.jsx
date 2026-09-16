import { lazy, Suspense, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { FeatureFlagsProvider } from './featureFlagsContext.jsx'
import FeatureRouteGuard from './FeatureRouteGuard.jsx'
import Home from './home.jsx'

const AdminDashboard = lazy(() => import('./admin/admin-dashboard.jsx'))
const AdminDonation = lazy(() => import('./admin/admin-donation.jsx'))
const AdminRequests = lazy(() => import('./admin/admin-requests.jsx'))
const AdminPartner = lazy(() => import('./admin/admin-partner.jsx'))
const AdminReports = lazy(() => import('./admin/admin-reports.jsx'))
const AdminInventory = lazy(() => import('./admin/admin-inventory.jsx'))
const AdminUsers = lazy(() => import('./admin/admin-users.jsx'))
const AdminAnnouncements = lazy(() => import('./admin/admin-announcements.jsx'))
const AdminMbd = lazy(() => import('./admin/admin-mbd.jsx'))
const UserDashboard = lazy(() => import('./user/user-dashboard.jsx'))
const ProfileSettings = lazy(() => import('./user/profile-settings.jsx'))
const HospitalInventory = lazy(() => import('./hospital/hospital-inventory.jsx'))
const HospitalBloodRequest = lazy(() => import('./hospital/hospital-blood-request.jsx'))
const HospitalTransactionHistory = lazy(() => import('./hospital/hospital-transaction-history.jsx'))
const HospitalReports = lazy(() => import('./hospital/hospital-reports.jsx'))
const DonorRegistration = lazy(() => import('./user/donor-registration.jsx'))
const GoogleDonorProfileSetup = lazy(() => import('./user/google-donor-profile-setup.jsx'))
const AdminFeatureSettings = lazy(() => import('./admin/admin-feature-settings.jsx'))
const ModuleUnavailable = lazy(() => import('./ModuleUnavailable.jsx'))
const SuperadminLogin = lazy(() => import('./admin/superadmin-login.jsx'))
const Rankings = lazy(() => import('./rankings.jsx'))

function RouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4" aria-busy="true">
      <p className="text-sm font-medium text-slate-600" role="status">Loading page…</p>
    </main>
  )
}

function RequireRole({ roles, children }) {
  const role = typeof localStorage !== 'undefined' ? localStorage.getItem('role') : null
  return roles.includes(role) ? children : <Navigate to="/" replace />
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    // React Router preserves the previous viewport position by default. Reset it
    // before the new page is painted so dashboard sign-ins always start at the top.
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <FeatureFlagsProvider>
        <FeatureRouteGuard>
          <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/ranking" element={<Navigate to="/rankings" replace />} />
            <Route path="/superadmin/login" element={<SuperadminLogin />} />
            <Route path="/register" element={<DonorRegistration />} />
            <Route path="/complete-google-donor-profile" element={<RequireRole roles={['donor']}><GoogleDonorProfileSetup /></RequireRole>} />
            <Route path="/module-unavailable" element={<ModuleUnavailable />} />
            <Route path="/dashboard" element={<RequireRole roles={['donor']}><UserDashboard /></RequireRole>} />
            <Route path="/donors" element={<Navigate to="/dashboard" replace />} />
            <Route path="/profile" element={<RequireRole roles={['donor']}><ProfileSettings /></RequireRole>} />
            <Route path="/admin/dashboard" element={<RequireRole roles={['admin']}><AdminDashboard /></RequireRole>} />
            <Route path="/admin/requests" element={<RequireRole roles={['admin']}><AdminRequests /></RequireRole>} />
            <Route path="/admin/inventory" element={<RequireRole roles={['admin']}><AdminInventory /></RequireRole>} />
            <Route path="/admin/donations" element={<RequireRole roles={['admin']}><AdminDonation /></RequireRole>} />
            <Route path="/admin/partners" element={<RequireRole roles={['admin']}><AdminPartner /></RequireRole>} />
            <Route path="/admin/partner" element={<Navigate to="/admin/partners" replace />} />
            <Route path="/admin/users" element={<RequireRole roles={['admin']}><AdminUsers /></RequireRole>} />
            <Route path="/admin/reports" element={<RequireRole roles={['admin']}><AdminReports /></RequireRole>} />
            <Route path="/admin/announcements" element={<RequireRole roles={['admin']}><AdminAnnouncements /></RequireRole>} />
            <Route path="/admin/mbd" element={<RequireRole roles={['admin']}><AdminMbd /></RequireRole>} />
            <Route path="/admin/prc-activities" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/superadmin/feature-settings" element={<RequireRole roles={['super_admin']}><AdminFeatureSettings /></RequireRole>} />
            <Route
              path="/admin/feature-settings"
              element={<Navigate to="/superadmin/feature-settings" replace />}
            />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/hospital/inventory" element={<RequireRole roles={['hospital']}><HospitalInventory /></RequireRole>} />
            <Route path="/hospital/blood-request" element={<RequireRole roles={['hospital']}><HospitalBloodRequest /></RequireRole>} />
            <Route path="/hospital/requests" element={<Navigate to="/hospital/blood-request" replace />} />
            <Route path="/hospital/transaction-history" element={<RequireRole roles={['hospital']}><HospitalTransactionHistory /></RequireRole>} />
            <Route path="/hospital/reports" element={<RequireRole roles={['hospital']}><HospitalReports /></RequireRole>} />
            <Route path="/hospital/dashboard" element={<Navigate to="/hospital/inventory" replace />} />
            <Route path="/hospital" element={<Navigate to="/hospital/inventory" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </FeatureRouteGuard>
      </FeatureFlagsProvider>
    </BrowserRouter>
  )
}

export default App
