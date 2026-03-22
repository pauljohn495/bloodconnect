import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'

function AdminUsers() {
  const [admins, setAdmins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [notification, setNotification] = useState(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    role: 'admin',
  })

  const currentUserRole = localStorage.getItem('role')

  useEffect(() => {
    loadAdmins()
  }, [])

  const loadAdmins = async () => {
    try {
      setIsLoading(true)
      const data = await apiRequest('/api/admin/admins')
      setAdmins(data)
    } catch (err) {
      showNotification('Failed to load admins', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      showNotification('Admin created successfully')
      setIsCreateModalOpen(false)
      resetForm()
      loadAdmins()
    } catch (err) {
      showNotification(err.message || 'Failed to create admin', 'error')
    }
  }

  const handleEditAdmin = async (e) => {
    e.preventDefault()
    try {
      await apiRequest(`/api/admin/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          username: formData.username,
          role: formData.role,
          status: formData.status,
        }),
      })
      showNotification('Admin updated successfully')
      setIsEditModalOpen(false)
      resetForm()
      loadAdmins()
    } catch (err) {
      showNotification(err.message || 'Failed to update admin', 'error')
    }
  }

  const handleDeleteAdmin = async (adminId) => {
    if (!confirm('Are you sure you want to delete this admin?')) return
    try {
      await apiRequest(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
      })
      showNotification('Admin deleted successfully')
      loadAdmins()
    } catch (err) {
      showNotification(err.message || 'Failed to delete admin', 'error')
    }
  }

  const openEditModal = (admin) => {
    setSelectedAdmin(admin)
    setFormData({
      fullName: admin.full_name,
      email: admin.email,
      username: admin.username,
      role: admin.role,
      status: admin.status,
    })
    setIsEditModalOpen(true)
  }

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      username: '',
      password: '',
      role: 'admin',
    })
    setSelectedAdmin(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <AdminLayout pageTitle="Manage Users" pageDescription="Manage admin accounts">
      <div className="space-y-6">
        {/* Notification */}
        {notification && (
          <div className={`rounded-lg p-4 ${
            notification.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin users</h2>
            <p className="mt-1 text-sm text-slate-500">Manage administrator accounts and roles</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Admin Account
          </button>
        </div>

        {/* Table */}
        <div className={adminPanel.violet.outer}>
          <div className={adminPanel.violet.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className={adminPanel.violet.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.violet.th}`}>
                    Name
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.violet.th}`}>
                    Email
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.violet.th}`}>
                    Username
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.violet.th}`}>
                    Role
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.violet.th}`}>
                    Status
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.violet.th}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={adminPanel.violet.tbody}>
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-sm text-slate-500">
                      Loading admin users...
                    </td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">
                      No admin users found
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        {admin.full_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {admin.email}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {admin.username}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                          admin.role === 'super_admin'
                            ? 'bg-purple-100 text-purple-700 ring-purple-200'
                            : 'bg-blue-100 text-blue-700 ring-blue-200'
                        }`}>
                          {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                          admin.status === 'active'
                            ? 'bg-green-100 text-green-700 ring-green-200'
                            : 'bg-red-100 text-red-700 ring-red-200'
                        }`}>
                          {admin.status ? admin.status.charAt(0).toUpperCase() + admin.status.slice(1) : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium">
                        <button
                          onClick={() => openEditModal(admin)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Admin Account</h3>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength="6"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  >
                    <option value="admin">Admin</option>
                    {currentUserRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false)
                      resetForm()
                    }}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Admin Account</h3>
              <form onSubmit={handleEditAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  >
                    <option value="admin">Admin</option>
                    {currentUserRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false)
                      resetForm()
                    }}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminUsers