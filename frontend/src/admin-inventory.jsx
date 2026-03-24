import { useEffect, useRef, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'
import { BloodTypeBadge } from './BloodTypeBadge.jsx'

function AdminInventory() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [notification, setNotification] = useState(null)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [bloodType, setBloodType] = useState('')
  const [units, setUnits] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [componentType, setComponentType] = useState('whole_blood')
  const [inventory, setInventory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [componentFilter, setComponentFilter] = useState('all') // 'all', 'whole_blood', 'platelets', 'plasma'
  const [openMenuItemId, setOpenMenuItemId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRefs = useRef({})

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const loadInventory = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/inventory')
      // Filter out items with 0 available units to keep the table clean
      const filteredData = data.filter(
        (item) => (item.available_units || item.availableUnits || 0) > 0,
      )
      setInventory(filteredData)
    } catch (err) {
      setError(err.message || 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (openMenuItemId) setOpenMenuItemId(null)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openMenuItemId])

  const handleOpenModal = () => {
    setIsEditMode(false)
    setEditingItemId(null)
    setIsModalOpen(true)
  }

  const handleEditItem = (item) => {
    setOpenMenuItemId(null)
    setIsEditMode(true)
    setEditingItemId(item.id)
    setBloodType(item.blood_type || item.bloodType || '')
    setUnits(String(item.available_units ?? item.availableUnits ?? item.units ?? ''))

    const rawDate = item.expiration_date || item.expirationDate
    const isoDate = rawDate ? new Date(rawDate).toISOString().split('T')[0] : ''
    setExpirationDate(isoDate)

    setComponentType(item.component_type || item.componentType || 'whole_blood')
    setIsModalOpen(true)
  }

  const handleDeleteItem = (item) => {
    setOpenMenuItemId(null)
    setItemToDelete(item)
    setIsDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setIsDeleting(false)
    setItemToDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return

    try {
      setIsDeleting(true)
      await apiRequest(`/api/admin/inventory/${itemToDelete.id}`, { method: 'DELETE' })
      await loadInventory()
      showNotification('Stock item deleted successfully!', 'primary')
      handleCloseDeleteModal()
    } catch (err) {
      showNotification(err.message || 'Failed to delete inventory item', 'destructive')
      setIsDeleting(false)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setIsEditMode(false)
    setEditingItemId(null)
    setIsSubmitting(false)
    setBloodType('')
    setUnits('')
    setExpirationDate('')
    setComponentType('whole_blood')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      await apiRequest(
        isEditMode ? `/api/admin/inventory/${editingItemId}` : '/api/admin/inventory',
        {
          method: isEditMode ? 'PUT' : 'POST',
          body: JSON.stringify({
            bloodType,
            units: Number(units),
            expirationDate,
            componentType,
          }),
        },
      )
      // Refresh table so latest changes appear immediately
      await loadInventory()
      showNotification(isEditMode ? 'Stock updated successfully!' : 'Stock added successfully!', 'primary')
      handleCloseModal()
    } catch (err) {
      showNotification(err.message || `Failed to ${isEditMode ? 'update' : 'add'} stock`, 'destructive')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter inventory based on status and component type
  const filteredInventory = inventory.filter((item) => {
    // Filter by component type
    if (componentFilter !== 'all') {
      const componentType = item.component_type || item.componentType || 'whole_blood' // Default to whole_blood if not specified
      if (componentFilter === 'whole_blood' && componentType !== 'whole_blood') return false
      if (componentFilter === 'platelets' && componentType !== 'platelets') return false
      if (componentFilter === 'plasma' && componentType !== 'plasma') return false
    }
    
    // Filter by status
    if (statusFilter === 'all') return true
    if (statusFilter === 'available') return item.status === 'available'
    if (statusFilter === 'near_expiry') return item.status === 'near_expiry' || item.status === 'Near Expiry'
    if (statusFilter === 'expired') return item.status === 'expired'
    return true
  })

  return (
    <AdminLayout
      pageTitle="Inventory"
      pageDescription="Monitor and manage system-wide blood inventory."
    >
      <section className="mt-2">
        <div className={adminPanel.rose.outer}>
          <div className={adminPanel.rose.header}>
            <div className="flex items-center gap-4">
              <div>
                <h2 className={adminPanel.rose.title}>Blood Inventory</h2>
                <p className={adminPanel.rose.subtitle}>
                  Complete inventory of all blood types and units
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComponentFilter('whole_blood')}
                  className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    componentFilter === 'whole_blood'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Whole Blood
                </button>
                <button
                  type="button"
                  onClick={() => setComponentFilter('platelets')}
                  className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    componentFilter === 'platelets'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Platelets
                </button>
                <button
                  type="button"
                  onClick={() => setComponentFilter('plasma')}
                  className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    componentFilter === 'plasma'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Plasma
                </button>
                {componentFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setComponentFilter('all')}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
              >
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="near_expiry">Near Expiry</option>
                <option value="expired">Expired</option>
              </select>
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                Add Stock
              </button>
            </div>
          </div>

          <div className={adminPanel.rose.tableScroll}>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className={adminPanel.rose.thead}>
                <tr>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.rose.th}`}>
                    Blood Type
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.rose.th}`}>
                    Available Units
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.rose.th}`}>
                    Expiration Date
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-left text-[13px] ${adminPanel.rose.th}`}>
                    Status
                  </th>
                  <th className={`whitespace-nowrap px-4 py-2 text-right text-[13px] ${adminPanel.rose.th}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={adminPanel.rose.tbody}>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                      Loading inventory...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={5}>
                      {error}
                    </td>
                  </tr>
                )}

                {!isLoading && !error && inventory.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      No inventory data available yet.
                    </td>
                  </tr>
                )}

                {!isLoading && !error && inventory.length > 0 && filteredInventory.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      {componentFilter !== 'all'
                        ? `No ${componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'} items found${statusFilter !== 'all' ? ` with status "${statusFilter === 'near_expiry' ? 'Near Expiry' : statusFilter}"` : ''}.`
                        : `No items found with status "${statusFilter === 'near_expiry' ? 'Near Expiry' : statusFilter}".`}
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        <BloodTypeBadge type={item.blood_type || item.bloodType} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-red-50 px-2 py-1 text-[13px] font-semibold text-red-700 ring-1 ring-red-100">
                          {item.available_units ?? item.availableUnits ?? item.units}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                        {item.expiration_date
                          ? new Date(item.expiration_date).toLocaleDateString()
                          : item.expirationDate
                          ? new Date(item.expirationDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${
                            item.status === 'available'
                              ? 'bg-green-50 text-green-700 ring-green-100'
                              : item.status === 'near_expiry' || item.status === 'Near Expiry'
                              ? 'bg-orange-50 text-orange-700 ring-orange-100'
                              : item.status === 'expired'
                              ? 'bg-red-50 text-red-700 ring-red-100'
                              : item.status === 'reserved'
                              ? 'bg-yellow-50 text-yellow-700 ring-yellow-100'
                              : 'bg-slate-50 text-slate-700 ring-slate-100'
                          }`}
                        >
                          {item.status === 'near_expiry' ? 'Near Expiry' : item.status || 'available'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm">
                        <div className="relative inline-block text-left">
                          <button
                            ref={(el) => (buttonRefs.current[item.id] = el)}
                            type="button"
                            onClick={() => {
                              const button = buttonRefs.current[item.id]
                              if (button) {
                                const rect = button.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + 8,
                                  right: window.innerWidth - rect.right,
                                })
                              }
                              setOpenMenuItemId((prev) => (prev === item.id ? null : item.id))
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            aria-haspopup="menu"
                            aria-expanded={openMenuItemId === item.id}
                            aria-label="Open inventory actions menu"
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
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {openMenuItemId && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuItemId(null)} />
          <div
            className="fixed z-50 w-40 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-slate-200 focus:outline-none"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
            role="menu"
            aria-label="Inventory actions"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                role="menuitem"
                onClick={() => {
                  const selectedItem = filteredInventory.find((entry) => entry.id === openMenuItemId)
                  if (selectedItem) handleEditItem(selectedItem)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                role="menuitem"
                onClick={() => {
                  const selectedItem = filteredInventory.find((entry) => entry.id === openMenuItemId)
                  if (selectedItem) handleDeleteItem(selectedItem)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{isEditMode ? 'Edit Stock' : 'Add Stock'}</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Component Type
                </label>
                <select
                  value={componentType}
                  onChange={(e) => setComponentType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="whole_blood">Whole Blood</option>
                  <option value="platelets">Platelets</option>
                  <option value="plasma">Plasma</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Units
                </label>
                <input
                  type="number"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Enter number of units"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Delete Stock</h3>
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

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm text-slate-900">
                Are you sure you want to delete this inventory record?
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Blood type:</span>
                <BloodTypeBadge type={itemToDelete?.blood_type || itemToDelete?.bloodType} />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-700">This action cannot be undone.</p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
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
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
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

export default AdminInventory



