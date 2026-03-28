import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'

const TYPE_OPTIONS = [
  { value: 'blood_drive', label: 'Blood Drive' },
  { value: 'urgent_need', label: 'Urgent Need' },
  { value: 'general', label: 'General' },
]

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
]

function typeLabel(type) {
  const t = TYPE_OPTIONS.find((o) => o.value === type)
  return t ? t.label : type
}

function statusLabel(status) {
  const s = STATUS_OPTIONS.find((o) => o.value === status)
  return s ? s.label : status
}

function toDatetimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatEventDisplay(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function TypeIcon({ type, className = 'h-4 w-4' }) {
  if (type === 'blood_drive') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    )
  }
  if (type === 'urgent_need') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    )
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function typeBadgeClasses(type) {
  if (type === 'urgent_need') return 'bg-red-100 text-red-800 ring-red-200'
  if (type === 'blood_drive') return 'bg-rose-100 text-rose-800 ring-rose-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

function statusBadgeClasses(status) {
  if (status === 'ongoing') return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
  if (status === 'completed') return 'bg-slate-100 text-slate-600 ring-slate-200'
  return 'bg-sky-100 text-sky-800 ring-sky-200'
}

const emptyForm = () => ({
  title: '',
  description: '',
  announcementType: 'general',
  eventStartsAt: '',
  location: '',
  status: 'upcoming',
})

function AdminAnnouncements() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/announcements')
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load announcements')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const openCreate = () => {
    setEditing(null)
    const next = emptyForm()
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    next.eventStartsAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setForm(next)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      title: row.title || '',
      description: row.description || '',
      announcementType: row.announcement_type || 'general',
      eventStartsAt: toDatetimeLocalValue(row.event_starts_at),
      location: row.location || '',
      status: row.status || 'upcoming',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const normalizeEventPayload = (local) => {
    if (!local) return null
    return local.replace('T', ' ').length === 16 ? `${local.replace('T', ' ')}:00` : local.replace('T', ' ')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const eventStartsAt = normalizeEventPayload(form.eventStartsAt)
    if (!eventStartsAt) {
      showNotification('Please set date and time', 'destructive')
      return
    }
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        description: form.description,
        announcementType: form.announcementType,
        eventStartsAt,
        location: form.location,
        status: form.status,
      }
      if (editing) {
        await apiRequest(`/api/admin/announcements/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        showNotification('Announcement updated')
      } else {
        await apiRequest('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        showNotification('Announcement created')
      }
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm())
      await load()
    } catch (err) {
      showNotification(err.message || 'Save failed', 'destructive')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiRequest(`/api/admin/announcements/${deleteTarget.id}`, { method: 'DELETE' })
      showNotification('Announcement deleted')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      showNotification(err.message || 'Delete failed', 'destructive')
    } finally {
      setDeleting(false)
    }
  }

  const mapsUrl = (loc) =>
    loc ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}` : null

  return (
    <AdminLayout
      pageTitle="Announcements"
      pageDescription="Post and manage blood drives, urgent needs, and general updates."
    >
      <div className="space-y-6">
        {notification && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
            role="status"
          >
            {notification.message}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Announcements</h2>
            <p className="mt-1 text-sm text-slate-500">
              Shown in chronological order (soonest event first). Urgent needs are highlighted in red.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:w-auto"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Announcement
          </button>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
            Loading announcements…
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className={adminPanel.amber.outer}>
            <div className="px-4 py-14 text-center sm:px-6">
              <p className="text-sm font-medium text-slate-600">No announcements yet.</p>
              <p className="mt-1 text-sm text-slate-500">Create one to inform donors about drives and urgent needs.</p>
            </div>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-2">
            {items.map((a) => {
              const urgent = a.announcement_type === 'urgent_need'
              return (
                <li
                  key={a.id}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition hover:shadow-md ${
                    urgent
                      ? 'border-red-200 ring-red-100/80'
                      : 'border-slate-200/90 ring-slate-100/90'
                  }`}
                >
                  <div
                    className={`flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 ${
                      urgent ? 'bg-gradient-to-br from-red-50/90 via-white to-white' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${typeBadgeClasses(
                              a.announcement_type,
                            )}`}
                          >
                            <TypeIcon type={a.announcement_type} className="h-3.5 w-3.5" />
                            {typeLabel(a.announcement_type)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${statusBadgeClasses(
                              a.status,
                            )}`}
                          >
                            {statusLabel(a.status)}
                          </span>
                        </div>
                        <h3
                          className={`mt-2 text-base font-semibold leading-snug sm:text-lg ${
                            urgent ? 'text-red-950' : 'text-slate-900'
                          }`}
                        >
                          {a.title}
                        </h3>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(a)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {a.description ? (
                      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600">{a.description}</p>
                    ) : (
                      <p className="mt-3 text-sm italic text-slate-400">No description</p>
                    )}

                    <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          When
                        </dt>
                        <dd className="text-slate-800">{formatEventDisplay(a.event_starts_at)}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Where
                        </dt>
                        <dd className="min-w-0 flex-1 text-slate-800">
                          {a.location ? (
                            <a
                              href={mapsUrl(a.location)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-red-700 underline decoration-red-200 underline-offset-2 hover:text-red-800"
                            >
                              {a.location}
                            </a>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close dialog"
            onClick={closeModal}
          />
          <div
            className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h3 id="announcement-modal-title" className="text-base font-semibold text-slate-900">
                {editing ? 'Edit announcement' : 'Add announcement'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                disabled={saving}
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                <div>
                  <label htmlFor="ann-title" className="block text-xs font-medium text-slate-700">
                    Title
                  </label>
                  <input
                    id="ann-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="e.g. City Hall Blood Drive"
                  />
                </div>
                <div>
                  <label htmlFor="ann-desc" className="block text-xs font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    id="ann-desc"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Details for donors…"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ann-type" className="block text-xs font-medium text-slate-700">
                      Type
                    </label>
                    <select
                      id="ann-type"
                      value={form.announcementType}
                      onChange={(e) => setForm((f) => ({ ...f, announcementType: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ann-status" className="block text-xs font-medium text-slate-700">
                      Status
                    </label>
                    <select
                      id="ann-status"
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="ann-when" className="block text-xs font-medium text-slate-700">
                    Date &amp; time
                  </label>
                  <input
                    id="ann-when"
                    type="datetime-local"
                    required
                    value={form.eventStartsAt}
                    onChange={(e) => setForm((f) => ({ ...f, eventStartsAt: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label htmlFor="ann-loc" className="block text-xs font-medium text-slate-700">
                    Location
                  </label>
                  <input
                    id="ann-loc"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    placeholder="Address or venue name"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Shown as a link to open in Google Maps.</p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" role="alertdialog">
            <h4 className="text-base font-semibold text-slate-900">Delete announcement?</h4>
            <p className="mt-2 text-sm text-slate-600">
              &ldquo;{deleteTarget.title}&rdquo; will be removed permanently.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminAnnouncements
