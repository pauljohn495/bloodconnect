const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')

const {
  findUserByIdentifier,
  findUserByEmail,
  isUsernameTaken,
  isUsernameTakenByOtherUser,
  isPhoneTaken,
  isPhoneTakenByOtherUser,
  isEmailTaken,
  getUniqueUsername,
  createUser,
  updateDonorGoogleProfile,
} = require('../models/authModel')
const { successResponse } = require('../utils/response')
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

function needsDonorProfileSetup(user) {
  const username = (user.username || '').toLowerCase()
  return user.role === 'donor' && (!user.phone || !user.blood_type || username.startsWith('google_'))
}

function buildAuthPayload(user) {
  const tokenPayload = {
    id: user.id,
    role: user.role,
    fullName: user.full_name,
    email: user.email,
  }

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '8h',
  })

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      status: user.status,
    },
    needsDonorProfileSetup: needsDonorProfileSetup(user),
  }
}

async function login(req, res, next) {
  const { identifier, password, role } = req.body

  try {
    const user = await findUserByIdentifier(identifier)
    if (!user) {
      const error = new Error('Invalid credentials')
      error.statusCode = 401
      throw error
    }

    const normalizedRole = role === 'recipient' ? 'donor' : role
    if (normalizedRole && user.role !== normalizedRole) {
      const error = new Error('User does not have the requested role')
      error.statusCode = 403
      throw error
    }

    if (user.status !== 'active') {
      const error = new Error('User account is not active')
      error.statusCode = 403
      throw error
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      const error = new Error('Invalid credentials')
      error.statusCode = 401
      throw error
    }

    const responseBody = buildAuthPayload(user)

    return successResponse(res, {
      message: 'Login successful',
      data: responseBody,
    })
  } catch (error) {
    return next(error)
  }
}

async function registerDonor(req, res, next) {
  const { fullName, username, email, password, phone, bloodType, role } = req.body

  try {
    const requestedRole = role === 'recipient' ? 'donor' : role
    const accountRole = 'donor'

    if (await isUsernameTaken(username)) {
      const error = new Error('Username is already taken')
      error.statusCode = 400
      throw error
    }

    if (await isPhoneTaken(phone)) {
      const error = new Error('Mobile number is already registered')
      error.statusCode = 400
      throw error
    }

    if (email && (await isEmailTaken(email))) {
      const error = new Error('Email is already registered')
      error.statusCode = 400
      throw error
    }

    if (requestedRole && requestedRole !== 'donor') {
      const error = new Error('Only donor/recipient account type is supported for this registration')
      error.statusCode = 400
      throw error
    }

    if (accountRole === 'donor' && !bloodType) {
      const error = new Error('Blood type is required for donor accounts')
      error.statusCode = 400
      throw error
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await createUser({
      fullName,
      username,
      email,
      phone,
      bloodType: accountRole === 'donor' ? bloodType : null,
      passwordHash,
      role: accountRole,
    })

    return successResponse(res, {
      statusCode: 201,
      message: 'Account registered successfully. You can now log in.',
      data: {
        message: 'Account registered successfully. You can now log in.',
      },
    })
  } catch (error) {
    return next(error)
  }
}

async function loginWithGoogle(req, res, next) {
  const { credential, role } = req.body

  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      const error = new Error('Google authentication is not configured')
      error.statusCode = 500
      throw error
    }

    const selectedRole = 'donor'
    const normalizedRole = role === 'recipient' ? 'donor' : role
    if (normalizedRole && normalizedRole !== 'donor') {
      const error = new Error('Google login is currently available for donor/recipient account type only')
      error.statusCode = 400
      throw error
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    const email = payload?.email ? payload.email.toLowerCase().trim() : ''
    const fullName = payload?.name || email.split('@')[0] || 'Google User'
    const emailVerified = payload?.email_verified === true

    if (!email || !emailVerified) {
      const error = new Error('Google account email must be verified')
      error.statusCode = 400
      throw error
    }

    let user = await findUserByEmail(email)

    if (user) {
      if (user.role !== 'donor') {
        const error = new Error('Google login is only available for donor accounts')
        error.statusCode = 403
        throw error
      }
    } else {
      const baseUsername = `google_${email.split('@')[0]}`
      const username = await getUniqueUsername(baseUsername)
      const passwordHash = await bcrypt.hash(`${Date.now()}-${email}`, 10)

      await createUser({
        fullName,
        username,
        email,
        phone: null,
        bloodType: null,
        passwordHash,
        role: selectedRole,
      })

      user = await findUserByEmail(email)
    }

    if (!user) {
      const error = new Error('Unable to complete Google login')
      error.statusCode = 500
      throw error
    }

    if (user.status !== 'active') {
      const error = new Error('User account is not active')
      error.statusCode = 403
      throw error
    }

    return successResponse(res, {
      message: 'Google login successful',
      data: buildAuthPayload(user),
    })
  } catch (error) {
    return next(error)
  }
}

async function completeGoogleDonorProfile(req, res, next) {
  const { username, bloodType, phone } = req.body

  try {
    if (req.user.role !== 'donor') {
      const error = new Error('Only donor accounts can complete this profile')
      error.statusCode = 403
      throw error
    }

    const trimmedUsername = (username || '').trim()
    const trimmedPhone = (phone || '').trim()
    const trimmedBloodType = (bloodType || '').trim()

    if (!trimmedUsername || !trimmedPhone || !trimmedBloodType) {
      const error = new Error('username, bloodType and phone are required')
      error.statusCode = 400
      throw error
    }

    if (await isUsernameTakenByOtherUser(trimmedUsername, req.user.id)) {
      const error = new Error('Username is already taken')
      error.statusCode = 400
      throw error
    }

    if (await isPhoneTakenByOtherUser(trimmedPhone, req.user.id)) {
      const error = new Error('Mobile number is already registered')
      error.statusCode = 400
      throw error
    }

    const updated = await updateDonorGoogleProfile({
      userId: req.user.id,
      username: trimmedUsername,
      phone: trimmedPhone,
      bloodType: trimmedBloodType,
    })

    if (!updated) {
      const error = new Error('Unable to update donor profile')
      error.statusCode = 400
      throw error
    }

    const user = await findUserByEmail(req.user.email)

    return successResponse(res, {
      message: 'Donor profile completed successfully',
      data: buildAuthPayload(user),
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  login,
  registerDonor,
  loginWithGoogle,
  completeGoogleDonorProfile,
}

