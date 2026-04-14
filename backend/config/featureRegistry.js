/**
 * Central registry for portal feature flags. Defaults are enabled (true) unless overridden in DB.
 *
 * To add a new toggle: push an entry with a unique `key`, valid `portal`, and optional `routePath`
 * for URL enforcement. Then wire the key into the relevant layout or page (nav filter, section hide).
 */
const PORTALS = ['admin', 'hospital', 'user', 'public']

const REGISTRY = [
  // —— Admin console (UI routes match AdminLayout sidebar) ——
  { key: 'admin.dashboard', portal: 'admin', label: 'Dashboard', group: 'Admin', routePath: '/admin/dashboard' },
  { key: 'admin.requests', portal: 'admin', label: 'Requests', group: 'Admin', routePath: '/admin/requests' },
  { key: 'admin.inventory', portal: 'admin', label: 'Inventory', group: 'Admin', routePath: '/admin/inventory' },
  { key: 'admin.donations', portal: 'admin', label: 'Donors / Organizations', group: 'Admin', routePath: '/admin/donations' },
  { key: 'admin.partners', portal: 'admin', label: 'Hospitals', group: 'Admin', routePath: '/admin/partners' },
  { key: 'admin.users', portal: 'admin', label: 'Manage Users', group: 'Admin', routePath: '/admin/users' },
  { key: 'admin.reports', portal: 'admin', label: 'Reports & Analytics', group: 'Admin', routePath: '/admin/reports' },
  { key: 'admin.announcements', portal: 'admin', label: 'Announcements', group: 'Admin', routePath: '/admin/announcements' },

  // —— Hospital portal ——
  { key: 'hospital.inventory', portal: 'hospital', label: 'Inventory', group: 'Hospital', routePath: '/hospital/inventory' },
  { key: 'hospital.blood_request', portal: 'hospital', label: 'Blood Request', group: 'Hospital', routePath: '/hospital/blood-request' },
  { key: 'hospital.transactions', portal: 'hospital', label: 'Transaction History', group: 'Hospital', routePath: '/hospital/transaction-history' },
  { key: 'hospital.reports', portal: 'hospital', label: 'Reports and Analytics', group: 'Hospital', routePath: '/hospital/reports' },

  // —— Donor / recipient ——
  { key: 'user.dashboard', portal: 'user', label: 'Donor dashboard', group: 'Donor / recipient', routePath: '/dashboard' },
  { key: 'user.profile', portal: 'user', label: 'Profile settings', group: 'Donor / recipient', routePath: '/profile' },
  { key: 'user.schedule', portal: 'user', label: 'Schedule donation', group: 'Donor / recipient' },
  { key: 'user.announcements', portal: 'user', label: 'Announcements (donor)', group: 'Donor / recipient' },
  { key: 'user.notifications', portal: 'user', label: 'Notifications', group: 'Donor / recipient' },

  // —— Public marketing / home ——
  { key: 'public.nav_announcements', portal: 'public', label: 'Nav: Announcements', group: 'Public site' },
  { key: 'public.nav_donate', portal: 'public', label: 'Nav: Donate', group: 'Public site' },
  { key: 'public.nav_about', portal: 'public', label: 'Nav: About', group: 'Public site' },
  { key: 'public.section_donate', portal: 'public', label: 'Donate section', group: 'Public site' },
  { key: 'public.section_about', portal: 'public', label: 'About section', group: 'Public site' },
  { key: 'public.register', portal: 'public', label: 'Registration & account CTA', group: 'Public site', routePath: '/register' },
]

const registryByKey = new Map(REGISTRY.map((e) => [e.key, e]))

function assertValidPortal(portal) {
  if (!PORTALS.includes(portal)) {
    const err = new Error(`Invalid portal: ${portal}`)
    err.statusCode = 400
    throw err
  }
}

function assertValidFlagKey(key) {
  const entry = registryByKey.get(key)
  if (!entry) {
    const err = new Error(`Unknown feature flag key: ${key}`)
    err.statusCode = 400
    throw err
  }
  return entry
}

function buildRouteCheckList() {
  return REGISTRY.filter((e) => e.routePath).map((e) => ({
    portal: e.portal,
    path: e.routePath,
    key: e.key,
  }))
}

module.exports = {
  PORTALS,
  REGISTRY,
  registryByKey,
  assertValidPortal,
  assertValidFlagKey,
  buildRouteCheckList,
}
