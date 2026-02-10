const jwt = require('jsonwebtoken')

function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing' })
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
      req.user = decoded

      if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' })
      }

      next()
    } catch (error) {
      console.error('JWT verification failed:', error)
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
  }
}

module.exports = auth


