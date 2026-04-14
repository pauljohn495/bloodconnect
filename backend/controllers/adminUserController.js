const {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  findAdminById,
  isUsernameTaken,
  isEmailTaken,
} = require('../models/adminUserModel')
const { successResponse } = require('../utils/response')

async function getAdminsController(req, res, next) {
  try {
    const admins = await getAllAdmins()
    return successResponse(res, {
      message: 'Admins fetched successfully',
      data: admins,
    })
  } catch (error) {
    return next(error)
  }
}

async function createAdminController(req, res, next) {
  try {
    const { fullName, email, username, password, role } = req.body

    // Basic validation
    if (!fullName || !email || !username || !password) {
      const error = new Error('All fields are required')
      error.statusCode = 400
      throw error
    }

    // Check if username or email is taken
    const [usernameTaken, emailTaken] = await Promise.all([
      isUsernameTaken(username),
      isEmailTaken(email),
    ])

    if (usernameTaken) {
      const error = new Error('Username is already taken')
      error.statusCode = 409
      throw error
    }

    if (emailTaken) {
      const error = new Error('Email is already taken')
      error.statusCode = 409
      throw error
    }

    // Validate role
    if (role && !['admin', 'super_admin'].includes(role)) {
      const error = new Error('Invalid role')
      error.statusCode = 400
      throw error
    }

    // Check permissions
    if (req.user.role === 'admin' && role === 'super_admin') {
      const error = new Error('Insufficient permissions to create super admin')
      error.statusCode = 403
      throw error
    }

    const adminId = await createAdmin({
      fullName,
      email,
      username,
      password,
      role: role || 'admin',
    })

    return successResponse(res, {
      statusCode: 201,
      message: 'Admin created successfully',
      data: { id: adminId },
    })
  } catch (error) {
    return next(error)
  }
}

async function updateAdminController(req, res, next) {
  try {
    const { id } = req.params
    const { fullName, email, username, role, status } = req.body

    // Check if admin exists
    const admin = await findAdminById(id)
    if (!admin) {
      const error = new Error('Admin not found')
      error.statusCode = 404
      throw error
    }

    if (admin.role === 'super_admin' && req.user.role === 'admin') {
      const error = new Error('Admin not found')
      error.statusCode = 404
      throw error
    }

    // Basic validation
    if (!fullName || !email || !username) {
      const error = new Error('Full name, email, and username are required')
      error.statusCode = 400
      throw error
    }

    // Check if username or email is taken by another admin
    const [usernameTaken, emailTaken] = await Promise.all([
      isUsernameTaken(username, id),
      isEmailTaken(email, id),
    ])

    if (usernameTaken) {
      const error = new Error('Username is already taken')
      error.statusCode = 409
      throw error
    }

    if (emailTaken) {
      const error = new Error('Email is already taken')
      error.statusCode = 409
      throw error
    }

    // Validate role
    if (role && !['admin', 'super_admin'].includes(role)) {
      const error = new Error('Invalid role')
      error.statusCode = 400
      throw error
    }

    // Check permissions
    if (req.user.role === 'admin' && role === 'super_admin') {
      const error = new Error('Insufficient permissions to assign super admin role')
      error.statusCode = 403
      throw error
    }

    // Validate status
    if (status && !['active', 'inactive'].includes(status)) {
      const error = new Error('Invalid status')
      error.statusCode = 400
      throw error
    }

    const updated = await updateAdmin(id, {
      fullName,
      email,
      username,
      role: role || admin.role,
      status: status || admin.status,
    })

    if (!updated) {
      const error = new Error('Failed to update admin')
      error.statusCode = 500
      throw error
    }

    return successResponse(res, {
      message: 'Admin updated successfully',
    })
  } catch (error) {
    return next(error)
  }
}

async function deleteAdminController(req, res, next) {
  try {
    const { id } = req.params

    // Check if admin exists
    const admin = await findAdminById(id)
    if (!admin) {
      const error = new Error('Admin not found')
      error.statusCode = 404
      throw error
    }

    if (admin.role === 'super_admin' && req.user.role === 'admin') {
      const error = new Error('Admin not found')
      error.statusCode = 404
      throw error
    }

    const deleted = await deleteAdmin(id)

    if (!deleted) {
      const error = new Error('Failed to delete admin')
      error.statusCode = 500
      throw error
    }

    return successResponse(res, {
      message: 'Admin deleted successfully',
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getAdminsController,
  createAdminController,
  updateAdminController,
  deleteAdminController,
}