import { useEffect, useRef, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from '../api.js'
import { adminPanel } from './admin-ui.jsx'

function AdminUsers() {
  const [admins, setAdmins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [openMenuAdminId, setOpenMenuAdminId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRefs = useRef({})
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

  useEffect(() => {
    const handleScroll = () => {
      if (openMenuAdminId) setOpenMenuAdminId(null)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openMenuAdminId])

  const loadAdmins = async () => {
    try {
      setIsLoading(true)
      const data = await apiRequest('/api/admin/admins')
      setAdmins(data)
    } catch (err) {
      showNotification('Failed to load admins', 'destructive')
    } finally {
      setIsLoading(false)
    }
  }

  const showNotification = (message, type = 'primary') => {
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
      showNotification(err.message || 'Failed to create admin', 'destructive')
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
      showNotification(err.message || 'Failed to update admin', 'destructive')
    }
  }

  const handleDeleteAdmin = (admin) => {
    setOpenMenuAdminId(null)
    setAdminToDelete(admin)
    setIsDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setAdminToDelete(null)
    setIsDeleting(false)
  }

  const handleConfirmDeleteAdmin = async () => {
    if (!adminToDelete) return

    try {
      setIsDeleting(true)
      await apiRequest(`/api/admin/admins/${adminToDelete.id}`, {
        method: 'DELETE',
      })
      showNotification('Admin deleted successfully')
      await loadAdmins()
      handleCloseDeleteModal()
    } catch (err) {
      showNotification(err.message || 'Failed to delete admin', 'destructive')
      setIsDeleting(false)
    }
  }

  const openEditModal = (admin) => {
    setOpenMenuAdminId(null)
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
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin users</h2>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
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
                  <th className={`whitespace-nowrap px-4 py-2 text-right text-[13px] ${adminPanel.violet.th}`}>
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
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                        <div className="relative inline-block text-right">
                          <button
                            ref={(el) => (buttonRefs.current[admin.id] = el)}
                            type="button"
                            onClick={() => {
                              const button = buttonRefs.current[admin.id]
                              if (button) {
                                const rect = button.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + 8,
                                  right: window.innerWidth - rect.right,
                                })
                              }
                              setOpenMenuAdminId((prev) => (prev === admin.id ? null : admin.id))
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            aria-haspopup="menu"
                            aria-expanded={openMenuAdminId === admin.id}
                            aria-label="Open admin actions menu"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6.5h.01M12 12h.01M12 17.5h.01"
                              />
                            </svg>
                          </button>
                        </div>
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

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-700 ring-1 ring-red-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v3m0 3h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Delete Admin Account</h3>
                    <p className="mt-0.5 text-xs text-slate-500">This action cannot be undone.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  className="text-slate-400 hover:text-slate-600"
                  disabled={isDeleting}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="mt-4 text-sm text-slate-700">
                Are you sure you want to remove this admin from the system?
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Name:</span>{' '}
                  {adminToDelete?.full_name || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Username:</span>{' '}
                  {adminToDelete?.username || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Email:</span>{' '}
                  {adminToDelete?.email || '—'}
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAdmin}
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {openMenuAdminId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuAdminId(null)} />
          <div
            className="fixed z-50 w-40 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-slate-200 focus:outline-none"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
            role="menu"
            aria-label="Admin actions"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                role="menuitem"
                onClick={() => {
                  const selectedAdminRecord = admins.find((entry) => entry.id === openMenuAdminId)
                  if (selectedAdminRecord) openEditModal(selectedAdminRecord)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                role="menuitem"
                onClick={() => {
                  const selectedAdminRecord = admins.find((entry) => entry.id === openMenuAdminId)
                  if (selectedAdminRecord) handleDeleteAdmin(selectedAdminRecord)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {notification && (
        <div className="fixed right-4 top-4 z-60 transition-all duration-300 ease-in-out">
          <div
            className={`flex min-w-[300px] max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {notification.type === 'destructive' ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className={`shrink-0 rounded p-1 transition hover:opacity-70 ${
                notification.type === 'destructive'
                  ? 'text-red-600 hover:bg-red-100'
                  : 'text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminUsers