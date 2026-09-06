import { useEffect, useState } from 'react'
import { apiRequest } from '../api.js'

export function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value) {
  const date = parseDate(value)
  if (!date) return { month: 'TBA', day: '—', weekday: 'TBA', full: 'Date to be announced', short: 'Date to be announced', time: 'Time to be announced' }
  return {
    month: date.toLocaleDateString(undefined, { month: 'short' }), day: date.toLocaleDateString(undefined, { day: '2-digit' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    full: date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    short: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  }
}

// Preserve the public endpoints and distinguish an unavailable API from an empty feed.
export function usePublicFeed(path) {
  const [state, setState] = useState({ items: [], status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ items: Array.isArray(data) ? data : [], status: 'success' })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ items: [], status: 'error' })
    })
    return () => controller.abort()
  }, [path, attempt])
  return { ...state, retry: () => { setState({ items: [], status: 'loading' }); setAttempt(value => value + 1) } }
}
