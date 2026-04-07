import { useState } from 'react'
import HospitalLayout from './HospitalLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'

function HospitalBloodRequest() {
  const [bloodType, setBloodType] = useState('')
  const [componentType, setComponentType] = useState('whole_blood')
  const [unitsRequested, setUnitsRequested] = useState('')
  const [notes, setNotes] = useState('')
  const [requestPriority, setRequestPriority] = useState('normal')
  const [notification, setNotification] = useState(null)

  const bloodTypes = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const resetForm = () => {
    setBloodType('')
    setComponentType('whole_blood')
    setUnitsRequested('')
    setNotes('')
    setRequestPriority('normal')
  }

  const handleSubmitRequest = async (e) => {
    e.preventDefault()

    if (!bloodType || !unitsRequested) {
      showNotification('Blood type and units requested are required', 'destructive')
      return
    }

    const units = parseInt(unitsRequested, 10)
    if (Number.isNaN(units) || units <= 0) {
      showNotification('Units requested must be a positive number', 'destructive')
      return
    }

    try {
      await apiRequest('/api/hospital/requests', {
        method: 'POST',
        body: JSON.stringify({
          bloodType,
          componentType,
          unitsRequested: units,
          notes: notes || null,
          priority: requestPriority,
        }),
      })
      showNotification('Blood request submitted successfully!', 'primary')
      resetForm()
    } catch (err) {
      console.error('Failed to submit request', err)
      showNotification(err.message || 'Failed to submit blood request', 'destructive')
    }
  }

  return (
    <HospitalLayout
      pageTitle="Blood Request"
      pageDescription="Submit a blood request to the blood bank."
    >
      <section className="mt-2">
        <div className={adminPanel.rose.outer}>
          <div className={adminPanel.rose.header}>
            <div>
              <h2 className={adminPanel.rose.title}>Request blood</h2>
              <p className={adminPanel.rose.subtitle}>
                Fill in the required details to submit a new blood request.
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Component Type <span className="text-red-500">*</span>
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
                  Request Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={requestPriority}
                  onChange={(e) => setRequestPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="normal">Normal - Standard request</option>
                  <option value="urgent">Urgent - Needed soon</option>
                  <option value="critical">Critical / Emergency - Immediate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Blood Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  required
                >
                  <option value="">Select blood type</option>
                  {bloodTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Units Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={unitsRequested}
                  onChange={(e) => setUnitsRequested(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Enter number of units"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="Add any additional notes or requirements"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {notification && (
        <div className="fixed top-4 right-4 z-60 transition-all duration-300 ease-in-out">
          <div
            className={`flex min-w-[300px] max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
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
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
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
    </HospitalLayout>
  )
}

export default HospitalBloodRequest
