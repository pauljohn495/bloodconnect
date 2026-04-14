import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getApiBaseUrl } from './api.js'

const FeatureFlagsContext = createContext(null)

export function FeatureFlagsProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState(null)
  const [routeChecks, setRouteChecks] = useState([])
  const [registry, setRegistry] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/feature-flags`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to load feature flags')
      }
      const data = json.data ?? json
      setFlags(data.flags || null)
      setRouteChecks(data.routeChecks || [])
      setRegistry(data.registry || [])
    } catch (e) {
      setError(e.message || 'Failed to load feature flags')
      setFlags(null)
      setRouteChecks([])
      setRegistry([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isFlagEnabled = useCallback(
    (portal, key) => {
      if (!flags || !flags[portal]) return true
      if (flags[portal][key] === undefined) return true
      return Boolean(flags[portal][key])
    },
    [flags],
  )

  const isPathEnabled = useCallback(
    (pathname) => {
      if (loading) return true
      if (!routeChecks?.length) return true
      const hit = routeChecks.find((r) => r.path === pathname)
      if (!hit) return true
      return isFlagEnabled(hit.portal, hit.key)
    },
    [loading, routeChecks, isFlagEnabled],
  )

  const value = useMemo(
    () => ({
      loading,
      error,
      flags,
      routeChecks,
      registry,
      refresh: load,
      isFlagEnabled,
      isPathEnabled,
    }),
    [loading, error, flags, routeChecks, registry, load, isFlagEnabled, isPathEnabled],
  )

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider')
  }
  return ctx
}
