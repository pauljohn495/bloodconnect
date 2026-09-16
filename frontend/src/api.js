/**
 * In Vite dev, default to same-origin + `/api` proxy (see vite.config.js) to avoid CORS.
 * Set VITE_API_URL when the API is on another host (e.g. staging/production).
 * VITE_API_BASE_URL remains supported for existing local setups.
 */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '')
  }
  if (import.meta.env.DEV) return ''
  // Never fall back to localhost in a deployed browser. Configure VITE_API_URL
  // in Vercel so requests are sent to the Render service.
  return ''
}

const API_BASE_URL = getApiBaseUrl()

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token')

  const hasBody = options.body !== undefined && options.body !== null
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const headers = {
    ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('Unable to reach the server. Check your connection and try again.', {
      cause: error,
    })
  }

  let data = null
  if (response.status !== 204) {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    }
  }

  if (!response.ok) {
    const message = data?.message || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.details = data?.errors || null
    throw error
  }

  // Support standardized API responses of shape:
  // { status: 'success', message: '...', data: {...} }
  // while remaining backward compatible with plain JSON payloads.
  if (data && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data
  }

  return data
}


