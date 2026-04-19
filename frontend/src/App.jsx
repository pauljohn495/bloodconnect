import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FeatureFlagsProvider } from './featureFlagsContext.jsx'
import FeatureRouteGuard from './FeatureRouteGuard.jsx'
import Home from './home.jsx'
import AdminDashboard from './admin-dashboard.jsx'
import AdminDonation from './admin-donation.jsx'
import AdminRequests from './admin-requests.jsx'
import AdminPartner from './admin-partner.jsx'
import AdminReports from './admin-reports.jsx'
import AdminInventory from './admin-inventory.jsx'
import AdminUsers from './admin-users.jsx'
import AdminAnnouncements from './admin-announcements.jsx'
import AdminMbd from './admin-mbd.jsx'
import UserDashboard from './user-dashboard.jsx'
import ProfileSettings from './profile-settings.jsx'
import HospitalInventory from './hospital-inventory.jsx'
import HospitalBloodRequest from './hospital-blood-request.jsx'
import HospitalTransactionHistory from './hospital-transaction-history.jsx'
import HospitalReports from './hospital-reports.jsx'
import DonorRegistration from './donor-registration.jsx'
import GoogleDonorProfileSetup from './google-donor-profile-setup.jsx'
import AdminFeatureSettings from './admin-feature-settings.jsx'
import ModuleUnavailable from './ModuleUnavailable.jsx'
import SuperadminLogin from './superadmin-login.jsx'

function App() {
  return (
    <BrowserRouter>
      <FeatureFlagsProvider>
        <FeatureRouteGuard>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/superadmin/login" element={<SuperadminLogin />} />
            <Route path="/register" element={<DonorRegistration />} />
            <Route path="/complete-google-donor-profile" element={<GoogleDonorProfileSetup />} />
            <Route path="/module-unavailable" element={<ModuleUnavailable />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/profile" element={<ProfileSettings />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/requests" element={<AdminRequests />} />
            <Route path="/admin/inventory" element={<AdminInventory />} />
            <Route path="/admin/donations" element={<AdminDonation />} />
            <Route path="/admin/partners" element={<AdminPartner />} />
            <Route path="/admin/partner" element={<Navigate to="/admin/partners" replace />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/mbd" element={<AdminMbd />} />
            <Route path="/admin/prc-activities" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/superadmin/feature-settings" element={<AdminFeatureSettings />} />
            <Route
              path="/admin/feature-settings"
              element={<Navigate to="/superadmin/feature-settings" replace />}
            />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/hospital/inventory" element={<HospitalInventory />} />
            <Route path="/hospital/blood-request" element={<HospitalBloodRequest />} />
            <Route path="/hospital/requests" element={<Navigate to="/hospital/blood-request" replace />} />
            <Route path="/hospital/transaction-history" element={<HospitalTransactionHistory />} />
            <Route path="/hospital/reports" element={<HospitalReports />} />
            <Route path="/hospital/dashboard" element={<Navigate to="/hospital/inventory" replace />} />
            <Route path="/hospital" element={<Navigate to="/hospital/inventory" replace />} />
          </Routes>
        </FeatureRouteGuard>
      </FeatureFlagsProvider>
    </BrowserRouter>
  )
}

export default App
