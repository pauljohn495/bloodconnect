const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

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

  return data
}


