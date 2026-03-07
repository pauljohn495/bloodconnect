const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const {
  findUserByIdentifier,
  isUsernameTaken,
  isPhoneTaken,
  isEmailTaken,
  createDonorUser,
} = require('../models/authModel')
const { successResponse } = require('../utils/response')

async function login(req, res, next) {
  const { identifier, password, role } = req.body

  try {
    const user = await findUserByIdentifier(identifier)
    if (!user) {
      const error = new Error('Invalid credentials')
      error.statusCode = 401
      throw error
    }

    if (role && user.role !== role) {
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

    const tokenPayload = {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: '8h',
    })

    const responseBody = {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        status: user.status,
      },
    }

    return successResponse(res, {
      message: 'Login successful',
      data: responseBody,
    })
  } catch (error) {
    return next(error)
  }
}

async function registerDonor(req, res, next) {
  const { fullName, username, email, password, phone, bloodType } = req.body

  try {
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

    const passwordHash = await bcrypt.hash(password, 10)

    await createDonorUser({
      fullName,
      username,
      email,
      phone,
      bloodType,
      passwordHash,
    })

    return successResponse(res, {
      statusCode: 201,
      message: 'Donor registered successfully. You can now log in.',
      data: {
        message: 'Donor registered successfully. You can now log in.',
      },
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  login,
  registerDonor,
}

