import { Navigate, useLocation } from 'react-router-dom'
import { useFeatureFlags } from './featureFlagsContext.jsx'

const EXACT_ALLOWLIST = new Set([
  '/module-unavailable',
  '/complete-google-donor-profile',
  '/superadmin/login',
])

const SUPERADMIN_ALLOWED_PATHS = new Set(['/superadmin/feature-settings', '/admin/users'])
const SUPERADMIN_HOME = '/superadmin/feature-settings'

function FeatureRouteGuard({ children }) {
  const location = useLocation()
  const { loading, isPathEnabled } = useFeatureFlags()

  if (EXACT_ALLOWLIST.has(location.pathname)) {
    return children
  }

  const role = typeof localStorage !== 'undefined' ? localStorage.getItem('role') : null
  if (role === 'super_admin') {
    const path = location.pathname.replace(/\/$/, '') || '/'
    if (path.startsWith('/superadmin') && path !== '/superadmin/feature-settings' && path !== '/superadmin/login') {
      return <Navigate to={SUPERADMIN_HOME} replace />
    }
    if (path.startsWith('/admin')) {
      if (path === '/admin') {
        return <Navigate to={SUPERADMIN_HOME} replace />
      }
      if (!SUPERADMIN_ALLOWED_PATHS.has(path)) {
        return <Navigate to={SUPERADMIN_HOME} replace />
      }
    }
  }

  if (loading) {
    return children
  }

  if (!isPathEnabled(location.pathname)) {
    return <Navigate to="/module-unavailable" replace />
  }

  return children
}

export default FeatureRouteGuard
