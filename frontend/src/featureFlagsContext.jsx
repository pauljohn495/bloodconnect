import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiBaseUrl } from './api.js'
import { FeatureFlagsContext } from './featureFlags.js'

const FEATURE_FLAG_CACHE_MS = 60_000
let cachedFeatureFlags = null
let cachedAt = 0
let featureFlagsRequest = null

async function fetchFeatureFlags(force = false) {
  const cacheIsFresh = cachedFeatureFlags && Date.now() - cachedAt < FEATURE_FLAG_CACHE_MS
  if (!force && cacheIsFresh) return cachedFeatureFlags
  if (!force && featureFlagsRequest) return featureFlagsRequest

  featureFlagsRequest = fetch(`${getApiBaseUrl()}/api/feature-flags`)
    .then(async (response) => {
      const json = await response.json()
      if (!response.ok) throw new Error(json?.message || 'Failed to load feature flags')
      cachedFeatureFlags = json.data ?? json
      cachedAt = Date.now()
      return cachedFeatureFlags
    })
    .finally(() => {
      featureFlagsRequest = null
    })

  return featureFlagsRequest
}

export function FeatureFlagsProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState(null)
  const [routeChecks, setRouteChecks] = useState([])
  const [registry, setRegistry] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFeatureFlags(force)
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

  const refresh = useCallback(() => load(true), [load])

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
      refresh,
      isFlagEnabled,
      isPathEnabled,
    }),
    [loading, error, flags, routeChecks, registry, refresh, isFlagEnabled, isPathEnabled],
  )

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}
