import { useEffect, useState, useRef } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'

function AdminPartner() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hospitalName, setHospitalName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [hospitals, setHospitals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [openMenuHospitalId, setOpenMenuHospitalId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRefs = useRef({})
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [selectedHospital, setSelectedHospital] = useState(null)
  const [availableInventory, setAvailableInventory] = useState([])
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [selectedStocks, setSelectedStocks] = useState({}) // { inventoryId: quantity }
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [notification, setNotification] = useState(null)
  const [transferHospitalId, setTransferHospitalId] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingHospital, setEditingHospital] = useState(null)
  const [editHospitalName, setEditHospitalName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')

  const loadHospitals = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/hospitals')
      setHospitals(data)
    } catch (err) {
      setError(err.message || 'Failed to load hospitals')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadHospitals()
  }, [])

  // Close menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (openMenuHospitalId) {
        setOpenMenuHospitalId(null)
      }
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openMenuHospitalId])

  // Menus are closed by toggling, selecting an action, or navigating away

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setHospitalName('')
    setUsername('')
    setPassword('')
    setEmail('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiRequest('/api/admin/hospitals', {
        method: 'POST',
        body: JSON.stringify({
          hospitalName,
          username,
          email,
          password,
        }),
      })
      // Refresh table so new hospital appears immediately
      await loadHospitals()
      handleCloseModal()
      showNotification('Hospital added successfully!', 'primary')
    } catch (err) {
      console.error('Failed to add hospital', err)
      showNotification(err.message || 'Failed to add hospital', 'destructive')
    }
  }

  const handleOpenEditModal = (hospital) => {
    setEditingHospital(hospital)
    setEditHospitalName(hospital.hospital_name || hospital.hospitalName || '')
    setEditEmail(hospital.email || '')
    setEditUsername(hospital.username || '')
    setEditPassword('') // Don't pre-fill password for security
    setIsEditModalOpen(true)
    setOpenMenuHospitalId(null)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setEditingHospital(null)
    setEditHospitalName('')
    setEditEmail('')
    setEditUsername('')
    setEditPassword('')
  }

  const handleUpdateHospital = async (e) => {
    e.preventDefault()
    if (!editingHospital) return

    try {
      const updateData = {
        hospitalName: editHospitalName,
        email: editEmail,
        username: editUsername,
      }
      
      // Only include password if it's been changed
      if (editPassword && editPassword.trim() !== '') {
        updateData.password = editPassword
      }

      await apiRequest(`/api/admin/hospitals/${editingHospital.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })
      
      await loadHospitals()
      handleCloseEditModal()
      showNotification('Hospital updated successfully!', 'primary')
    } catch (err) {
      console.error('Failed to update hospital', err)
      showNotification(err.message || 'Failed to update hospital', 'destructive')
    }
  }

  const handleDeleteHospital = async (hospital) => {
    const name = hospital.hospital_name || hospital.hospitalName || 'this hospital'
    const confirmed = window.confirm(`Delete ${name}? This will remove its hospital login too.`)
    if (!confirmed) return

    try {
      await apiRequest(`/api/admin/hospitals/${hospital.id}`, { method: 'DELETE' })
      setOpenMenuHospitalId(null)
      await loadHospitals()
      showNotification('Hospital deleted successfully!', 'primary')
    } catch (err) {
      console.error('Failed to delete hospital', err)
      showNotification(err.message || 'Failed to delete hospital', 'destructive')
    }
  }

  const handleOpenTransferModal = async (hospital) => {
    setSelectedHospital(hospital)
    setIsTransferModalOpen(true)
    setSelectedStocks({})
    setIsLoadingInventory(true)

    try {
      // Fetch available inventory (where hospital_id is NULL)
      const data = await apiRequest('/api/admin/inventory')
      // Filter for available stocks (status='available' or 'near_expiry', available_units > 0, hospital_id is null, not expired)
      const available = data.filter(
        (item) =>
          (item.status === 'available' || item.status === 'near_expiry') &&
          (item.available_units || item.availableUnits || 0) > 0 &&
          (!item.hospital_id || item.hospital_id === null || item.hospitalId === null) &&
          item.status !== 'expired',
      )
      setAvailableInventory(available)
    } catch (err) {
      console.error('Failed to load inventory', err)
      showNotification(err.message || 'Failed to load available inventory', 'destructive')
    } finally {
      setIsLoadingInventory(false)
    }
  }

  const handleCloseTransferModal = () => {
    setIsTransferModalOpen(false)
    setSelectedHospital(null)
    setSelectedStocks({})
    setAvailableInventory([])
    setTransferHospitalId(null)
    setShowConfirmDialog(false)
  }

  const handleStockToggle = (inventoryId, availableUnits) => {
    setSelectedStocks((prev) => {
      const newStocks = { ...prev }
      if (newStocks[inventoryId]) {
        delete newStocks[inventoryId]
      } else {
        newStocks[inventoryId] = 1 // Default to 1 unit
      }
      return newStocks
    })
  }

  const handleQuantityChange = (inventoryId, quantity, maxAvailable) => {
    const numQuantity = Math.max(1, Math.min(parseInt(quantity) || 1, maxAvailable))
    setSelectedStocks((prev) => ({
      ...prev,
      [inventoryId]: numQuantity,
    }))
  }

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const handleConfirmTransferClick = () => {
    if (!selectedHospital || Object.keys(selectedStocks).length === 0) {
      showNotification('Please select at least one blood stock to transfer', 'destructive')
      return
    }
    // Store hospital ID before showing dialog to prevent it from being lost
    setTransferHospitalId(selectedHospital.id)
    setShowConfirmDialog(true)
  }

  const handleConfirmTransfer = async () => {
    setShowConfirmDialog(false)
    
    // Use stored hospital ID or fallback to selectedHospital
    const hospitalId = transferHospitalId || selectedHospital?.id
    if (!hospitalId) {
      showNotification('Hospital information is missing. Please try again.', 'destructive')
      return
    }
    
    const transfers = Object.entries(selectedStocks).map(([inventoryId, units]) => ({
      inventoryId: parseInt(inventoryId),
      units: parseInt(units),
    }))

    try {
      await apiRequest('/api/admin/transfer', {
        method: 'POST',
        body: JSON.stringify({
          hospitalId: hospitalId,
          transfers,
        }),
      })
      
      // Refresh available inventory to remove items with 0 available units
      setIsLoadingInventory(true)
      let updatedAvailableInventory = []
      try {
        const data = await apiRequest('/api/admin/inventory')
        // Filter for available stocks (status='available' or 'near_expiry', available_units > 0, hospital_id is null, not expired)
        updatedAvailableInventory = data.filter(
          (item) =>
            (item.status === 'available' || item.status === 'near_expiry') &&
            (item.available_units || item.availableUnits || 0) > 0 &&
            (!item.hospital_id || item.hospital_id === null || item.hospitalId === null) &&
            item.status !== 'expired',
        )
        setAvailableInventory(updatedAvailableInventory)
      } catch (err) {
        console.error('Failed to refresh inventory', err)
      } finally {
        setIsLoadingInventory(false)
      }
      
      // Clear selections
      setSelectedStocks({})
      
      showNotification('Blood stocks transferred successfully!', 'primary')
      
      // Refresh hospital list to update totals (this will show the transferred blood in the hospital table)
      await loadHospitals()
      
      // Close the transfer modal after successful transfer
      handleCloseTransferModal()
    } catch (err) {
      console.error('Transfer failed', err)
      showNotification(err.message || 'Failed to transfer blood stocks', 'destructive')
    }
  }

  return (
    <AdminLayout
      pageTitle="Hospitals / Partner Centers"
      pageDescription="Manage partner hospitals."
    >
      <section className="mt-2">
        <div className="h-[600px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Partner Hospitals</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                List of all partnered hospitals
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
            >
              Add Hospital
            </button>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Hospital Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Total Available Blood Stock
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-left text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Total Blood Stock Donated
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 text-right text-[13px] font-semibold text-slate-600 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={4}>
                      Loading hospitals...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-red-500" colSpan={4}>
                      {error}
                    </td>
                  </tr>
                )}

                {!isLoading && !error && hospitals.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>
                      No partner hospitals added yet.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  hospitals.map((hospital) => (
                    <tr key={hospital.id} className="group hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold text-slate-900">
                        {hospital.hospital_name || hospital.hospitalName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-emerald-50 px-2 py-1 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          {hospital.total_available_units ?? 0}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-sky-50 px-2 py-1 text-[13px] font-semibold text-sky-700 ring-1 ring-sky-100">
                          {hospital.total_donated_units ?? 0}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            ref={(el) => (buttonRefs.current[hospital.id] = el)}
                            type="button"
                            onClick={() => {
                              const button = buttonRefs.current[hospital.id]
                              if (button) {
                                const rect = button.getBoundingClientRect()
                                setMenuPosition({
                                  top: rect.bottom + 8,
                                  right: window.innerWidth - rect.right,
                                })
                              }
                              setOpenMenuHospitalId((prev) => (prev === hospital.id ? null : hospital.id))
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm opacity-0 transition hover:bg-slate-50 hover:text-slate-900 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 group-hover:opacity-100"
                            aria-haspopup="menu"
                            aria-expanded={openMenuHospitalId === hospital.id}
                            aria-label="Open hospital actions menu"
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

      {/* Menu dropdown rendered outside table to escape overflow */}
      {openMenuHospitalId && (
        <>
          {/* Backdrop to close menu on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenMenuHospitalId(null)}
          />
          {/* Menu dropdown */}
          <div
            className="fixed z-50 w-44 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-slate-200 focus:outline-none"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
            role="menu"
            aria-label="Hospital actions"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                role="menuitem"
                onClick={() => {
                  const hospital = hospitals.find((h) => h.id === openMenuHospitalId)
                  if (hospital) {
                    setOpenMenuHospitalId(null)
                    handleOpenTransferModal(hospital)
                  }
                }}
              >
                Transfer
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                role="menuitem"
                onClick={() => {
                  const hospital = hospitals.find((h) => h.id === openMenuHospitalId)
                  if (hospital) {
                    handleOpenEditModal(hospital)
                  }
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                role="menuitem"
                onClick={() => {
                  const hospital = hospitals.find((h) => h.id === openMenuHospitalId)
                  if (hospital) {
                    handleDeleteHospital(hospital)
                  }
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
              <h3 className="text-sm font-semibold text-slate-900">Add Hospital</h3>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Hospital Name
                </label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter hospital name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter hospital email"
                />
              </div>

              <div className="pt-1">
                <p className="text-[11px] font-semibold text-slate-700">
                  Login Credentials
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter password"
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
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Save Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hospital Modal */}
      {isEditModalOpen && editingHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Edit Hospital</h3>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateHospital} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Hospital Name
                </label>
                <input
                  type="text"
                  value={editHospitalName}
                  onChange={(e) => setEditHospitalName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter hospital name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter hospital email"
                  required
                />
              </div>

              <div className="pt-1">
                <p className="text-[11px] font-semibold text-slate-700">
                  Login Credentials
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Password <span className="text-slate-400">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter new password (optional)"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Update Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && selectedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Transfer Blood Stock
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Transfer to: {selectedHospital.hospital_name || selectedHospital.hospitalName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseTransferModal}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingInventory ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading available inventory...
                </div>
              ) : availableInventory.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No available blood stocks to transfer.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                            checked={
                              availableInventory.length > 0 &&
                              availableInventory.every((item) => selectedStocks[item.id])
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allSelected = {}
                                availableInventory.forEach((item) => {
                                  allSelected[item.id] = 1
                                })
                                setSelectedStocks(allSelected)
                              } else {
                                setSelectedStocks({})
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Blood Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Available Units
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Expiration Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Units to Transfer
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {availableInventory.map((item) => {
                        const availableUnits = item.available_units || item.availableUnits || 0
                        const isSelected = !!selectedStocks[item.id]
                        const transferQuantity = selectedStocks[item.id] || 1

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50 ${isSelected ? 'bg-red-50/30' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                                checked={isSelected}
                                onChange={() => handleStockToggle(item.id, availableUnits)}
                              />
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {item.blood_type || item.bloodType}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                {availableUnits}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {item.expiration_date
                                ? new Date(item.expiration_date).toLocaleDateString()
                                : item.expirationDate
                                ? new Date(item.expirationDate).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
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
                            <td className="px-4 py-3">
                              {isSelected ? (
                                <input
                                  type="number"
                                  min="1"
                                  max={availableUnits}
                                  value={transferQuantity}
                                  onChange={(e) =>
                                    handleQuantityChange(item.id, e.target.value, availableUnits)
                                  }
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                />
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <div className="text-sm text-slate-600">
                {Object.keys(selectedStocks).length > 0 && (
                  <span>
                    {Object.keys(selectedStocks).length} stock(s) selected
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCloseTransferModal}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTransferClick}
                  disabled={Object.keys(selectedStocks).length === 0}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <button
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
              type="button"
              onClick={() => setShowConfirmDialog(false)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Confirm Transfer</h2>
            </div>
            
            <div className="px-6 py-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to transfer{' '}
                <strong>{Object.keys(selectedStocks).length}</strong> blood stock(s) to{' '}
                <strong>{selectedHospital?.hospital_name || selectedHospital?.hospitalName}</strong>?
              </p>
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(selectedStocks).map(([inventoryId, units]) => {
                  const item = availableInventory.find((i) => i.id === parseInt(inventoryId))
                  if (!item) return null
                  return (
                    <div key={inventoryId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-900">
                        {item.blood_type || item.bloodType}
                      </span>
                      <span className="text-slate-600">{units} unit(s)</span>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="border-t border-slate-200 px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTransfer}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition"
                >
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Container */}
      {notification && (
        <div className="fixed top-4 right-4 z-[200] transition-all duration-300 ease-in-out">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-[300px] max-w-md ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {notification.type === 'destructive' ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="shrink-0 rounded p-1 transition hover:opacity-70 text-red-600 hover:bg-red-100"
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

export default AdminPartner
