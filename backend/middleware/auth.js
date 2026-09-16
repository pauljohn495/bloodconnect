const jwt = require('jsonwebtoken')

function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing' })
    }

    try {
      const secret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : null)
      if (!secret) {
        return res.status(503).json({ message: 'Authentication is not configured' })
      }
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })
      if (!decoded || !Number.isInteger(Number(decoded.id)) || typeof decoded.role !== 'string') {
        return res.status(401).json({ message: 'Invalid or expired token' })
      }
      req.user = decoded

      if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' })
      }

      next()
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
  }
}

module.exports = auth


