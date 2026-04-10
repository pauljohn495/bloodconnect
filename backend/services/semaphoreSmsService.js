/**
 * Semaphore SMS (Philippines) — https://api.semaphore.co/api/v4/messages
 * Env: SEMAPHORE_API_KEY (required), SEMAPHORE_SENDER_NAME (optional, registered sender ID)
 */

const SEMAPHORE_MESSAGES_URL = 'https://api.semaphore.co/api/v4/messages'

function parseBoolean(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'true'
}

/** Normalize PH mobile to digits with country code 63 (no +). */
function normalizePhilippinePhone(raw) {
  if (raw == null || raw === '') return null
  let d = String(raw).replace(/\D/g, '')
  if (d.length === 0) return null
  if (d.startsWith('0')) d = `63${d.slice(1)}`
  else if (!d.startsWith('63')) d = `63${d}`
  if (d.length < 12 || d.length > 13) return null
  return d
}

function isSemaphoreConfigured() {
  return Boolean(process.env.SEMAPHORE_API_KEY && String(process.env.SEMAPHORE_API_KEY).trim())
}

/**
 * @returns {{ ok: true, raw: unknown } | { ok: false, error: string }}
 */
async function sendSemaphoreSms({ to, message }) {
  const apikey = process.env.SEMAPHORE_API_KEY
  if (!apikey || !String(apikey).trim()) {
    return { ok: false, error: 'SEMAPHORE_API_KEY is not set' }
  }

  const number = normalizePhilippinePhone(to)
  if (!number) {
    return { ok: false, error: 'Invalid or missing phone number' }
  }

  const body = new URLSearchParams()
  body.set('apikey', String(apikey).trim())
  body.set('number', number)
  body.set('message', message)

  const sendername = process.env.SEMAPHORE_SENDER_NAME
  if (sendername && String(sendername).trim()) {
    body.set('sendername', String(sendername).trim())
  }

  try {
    const res = await fetch(SEMAPHORE_MESSAGES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
    })

    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }

    if (!res.ok) {
      const msg =
        typeof json === 'object' && json !== null && json.message
          ? String(json.message)
          : `HTTP ${res.status}: ${text.slice(0, 200)}`
      return { ok: false, error: msg }
    }

    let messageId = null
    if (Array.isArray(json) && json[0] && json[0].message_id != null) {
      messageId = String(json[0].message_id)
    } else if (json && typeof json === 'object' && json.message_id != null) {
      messageId = String(json.message_id)
    }

    return { ok: true, raw: json, messageId }
  } catch (err) {
    return { ok: false, error: err.message || 'Semaphore request failed' }
  }
}

module.exports = {
  sendSemaphoreSms,
  normalizePhilippinePhone,
  isSemaphoreConfigured,
  parseBoolean,
}
