const requestAttempts = new Map()

function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
}

function createRateLimit({ windowMs = 15 * 60 * 1000, max = 15 } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${req.ip}:${req.baseUrl}${req.path}`
    const previous = requestAttempts.get(key)
    const record = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : previous

    record.count += 1
    requestAttempts.set(key, record)

    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - record.count)))
    res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)))

    if (record.count > max) {
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({
        status: 'error',
        message: 'Too many attempts. Please wait and try again.',
        errors: null,
      })
    }

    // Opportunistic cleanup keeps the in-memory store bounded on long-running servers.
    if (requestAttempts.size > 5000) {
      for (const [storedKey, storedRecord] of requestAttempts) {
        if (storedRecord.resetAt <= now) requestAttempts.delete(storedKey)
      }
    }

    return next()
  }
}

module.exports = { applySecurityHeaders, createRateLimit }
