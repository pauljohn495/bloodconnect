import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { useFeatureFlags } from './featureFlagsContext.jsx'

const PORTAL_LABELS = {
  admin: 'Admin console',
  hospital: 'Hospital portal',
  user: 'Donor / recipient',
  public: 'Public website',
}

function AdminFeatureSettings() {
  const role = localStorage.getItem('role')
  const { refresh } = useFeatureFlags()
  const [registry, setRegistry] = useState([])
  const [flags, setFlags] = useState(null)
  const [portals, setPortals] = useState([])
  const [pending, setPending] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest('/api/admin/feature-flags')
      setRegistry(data.registry || [])
      setFlags(data.flags || {})
      setPortals(data.portals || [])
      setPending({})
    } catch (e) {
      setError(e.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'super_admin') load()
  }, [load, role])

  const grouped = useMemo(() => {
    const by = {}
    for (const p of portals.length ? portals : ['admin', 'hospital', 'user', 'public']) {
      by[p] = []
    }
    for (const entry of registry) {
      if (!by[entry.portal]) by[entry.portal] = []
      by[entry.portal].push(entry)
    }
    return by
  }, [registry, portals])

  const effective = useCallback(
    (portal, key) => {
      const k = `${portal}:${key}`
      if (Object.prototype.hasOwnProperty.call(pending, k)) {
        return pending[k]
      }
      if (!flags?.[portal]) return true
      if (flags[portal][key] === undefined) return true
      return Boolean(flags[portal][key])
    },
    [flags, pending],
  )

  const toggle = (portal, key, enabled) => {
    setPending((prev) => ({ ...prev, [`${portal}:${key}`]: enabled }))
  }

  const hasChanges = Object.keys(pending).length > 0

  const save = async () => {
    if (!hasChanges) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const updates = Object.entries(pending).map(([compound, enabled]) => {
        const sep = compound.indexOf(':')
        const portal = compound.slice(0, sep)
        const key = compound.slice(sep + 1)
        return { portal, key, enabled }
      })
      await apiRequest('/api/admin/feature-flags', {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      })
      setPending({})
      await load()
      await refresh()
      setMessage('Module visibility saved.')
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />
  }

  return (
    <AdminLayout
      pageTitle="Module visibility"
      pageDescription="Show or hide pages and features across portals. Disabled items are hidden from navigation and blocked by direct links."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {message && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Changes apply after save. Only super administrators can edit; other admins still inherit hidden modules.
          </p>
          <button
            type="button"
            disabled={!hasChanges || saving}
            onClick={save}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([portal, entries]) => (
              <section
                key={portal}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80"
              >
                <h2 className="text-base font-semibold text-slate-900">
                  {PORTAL_LABELS[portal] || portal}
                </h2>
                <ul className="mt-4 divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const on = effective(entry.portal, entry.key)
                    return (
                      <li key={entry.key} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{entry.label}</p>
                          <p className="text-xs text-slate-500">
                            {entry.key}
                            {entry.routePath ? ` · ${entry.routePath}` : ''}
                          </p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <span className="text-xs font-medium text-slate-600">{on ? 'Visible' : 'Hidden'}</span>
                          <input
                            type="checkbox"
                            className="h-5 w-10 cursor-pointer accent-red-600"
                            checked={on}
                            onChange={(e) => toggle(entry.portal, entry.key, e.target.checked)}
                          />
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500">
          To register a new toggle, add an entry to <code className="rounded bg-slate-100 px-1">backend/config/featureRegistry.js</code>{' '}
          and wire the key into the relevant React layout or page.
        </p>
      </div>
    </AdminLayout>
  )
}

export default AdminFeatureSettings
