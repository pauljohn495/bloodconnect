import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'

function ModuleUnavailable() {
  const role = typeof localStorage !== 'undefined' ? localStorage.getItem('role') : null
  const homeHref =
    role === 'super_admin'
      ? '/superadmin/feature-settings'
      : role === 'admin'
        ? '/admin/dashboard'
        : role === 'hospital'
          ? '/hospital/inventory'
          : role === 'donor'
            ? '/dashboard'
            : '/'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandLogo className="h-14 w-14 rounded-xl" roundedClass="rounded-xl" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">This page is unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          This module has been turned off by an administrator. If you believe this is a mistake, contact your
          organization&apos;s BloodConnect admin.
        </p>
        <Link
          to={homeHref}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default ModuleUnavailable
