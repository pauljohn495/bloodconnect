import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './home.jsx'
import AdminDashboard from './admin-dashboard.jsx'
import AdminDonation from './admin-donation.jsx'
import AdminRequests from './admin-requests.jsx'
import AdminPartner from './admin-partner.jsx'
import AdminReports from './admin-reports.jsx'
import AdminInventory from './admin-inventory.jsx'
import UserDashboard from './user-dashboard.jsx'
import ProfileSettings from './profile-settings.jsx'
import HospitalDashboard from './hospital-dashboard.jsx'
import HospitalInventory from './hospital-inventory.jsx'
import HospitalRequests from './hospital-requests.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/profile" element={<ProfileSettings />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/inventory" element={<AdminInventory />} />
        <Route path="/admin/donations" element={<AdminDonation />} />
        <Route path="/admin/partners" element={<AdminPartner />} />
        <Route path="/admin/partner" element={<Navigate to="/admin/partners" replace />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        <Route path="/hospital/inventory" element={<HospitalInventory />} />
        <Route path="/hospital/requests" element={<HospitalRequests />} />
        <Route path="/hospital" element={<Navigate to="/hospital/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
