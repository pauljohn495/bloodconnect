/**
 * In Vite dev, default to same-origin + `/api` proxy (see vite.config.js) to avoid CORS.
 * Set VITE_API_BASE_URL when the API is on another host (e.g. production).
 */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '')
  }
  if (import.meta.env.DEV) return ''
  return 'http://localhost:3000'
}

const API_BASE_URL = getApiBaseUrl()

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token')

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // ignore JSON parse errors for empty responses
  }

  if (!response.ok) {
    const message = data?.message || 'Request failed'
    throw new Error(message)
  }

  // Support standardized API responses of shape:
  // { status: 'success', message: '...', data: {...} }
  // while remaining backward compatible with plain JSON payloads.
  if (data && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data
  }

  return data
}


