import { useCallback, useEffect, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import './admin-prc-activities-calendar.css'

function toDateKey(d) {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function formatDateTimeAdded(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200'
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-600'

/** Full PRC Activities calendar + CRUD, embedded on the admin dashboard only. */
export default function PrcActivitiesDashboardSection() {
  const p = adminPanel.sky
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const [modal, setModal] = useState(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const showToast = (message, tone = 'ok') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 3500)
  }

  const loadActivities = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/prc-activities')
      setActivities(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Failed to load activities')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const todayKey = useMemo(() => toDateKey(new Date()), [])

  const filteredActivities = useMemo(() => {
    let list = activities
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q),
      )
    }
    if (scopeFilter === 'upcoming') {
      list = list.filter((a) => a.activity_date >= todayKey)
    }
    if (scopeFilter === 'month') {
      list = list.filter((a) => {
        const [yy, mm] = a.activity_date.split('-').map(Number)
        return yy === viewYear && mm - 1 === viewMonth
      })
    }
    return list
  }, [activities, searchQuery, scopeFilter, viewYear, viewMonth, todayKey])

  const calendarEvents = useMemo(
    () =>
      filteredActivities.map((a) => ({
        id: String(a.id),
        title: a.title,
        start: a.activity_date,
        allDay: true,
        extendedProps: { activity: a },
      })),
    [filteredActivities],
  )

  const openCreate = (dateKey) => {
    setFormTitle('')
    setFormDescription('')
    setFormDate(dateKey)
    setModal({ mode: 'form', editingId: null })
  }

  const openView = (activity) => {
    setModal({ mode: 'view', activity })
  }

  const openEdit = (activity) => {
    setFormTitle(activity.title || '')
    setFormDescription(activity.description || '')
    setFormDate(activity.activity_date || '')
    setModal({ mode: 'form', editingId: activity.id })
  }

  const closeModal = () => {
    setModal(null)
    setPendingDelete(null)
    setFormTitle('')
    setFormDescription('')
    setFormDate('')
    setSaving(false)
  }

  const handleSubmitForm = async (e) => {
    e.preventDefault()
    const title = formTitle.trim()
    if (!title || !formDate) {
      showToast('Title and date are required.', 'err')
      return
    }
    setSaving(true)
    try {
      if (modal?.editingId) {
        await apiRequest(`/api/admin/prc-activities/${modal.editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            description: formDescription,
            activityDate: formDate,
          }),
        })
        showToast('Activity updated.')
      } else {
        await apiRequest('/api/admin/prc-activities', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description: formDescription,
            activityDate: formDate,
          }),
        })
        showToast('Activity added.')
      }
      closeModal()
      await loadActivities()
    } catch (err) {
      showToast(err.message || 'Could not save activity', 'err')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (activity) => {
    if (!activity?.id) return
    setPendingDelete(activity)
  }

  const cancelDelete = () => {
    if (deleteLoading) return
    setPendingDelete(null)
  }

  const confirmDelete = async () => {
    const activity = pendingDelete
    if (!activity?.id) return
    setDeleteLoading(true)
    try {
      await apiRequest(`/api/admin/prc-activities/${activity.id}`, { method: 'DELETE' })
      showToast('Activity deleted.')
      setPendingDelete(null)
      closeModal()
      await loadActivities()
    } catch (err) {
      showToast(err.message || 'Could not delete', 'err')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete activity?"
        message={
          pendingDelete
            ? `This will permanently remove “${pendingDelete.title}”. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === 'err'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="mt-6" aria-label="PRC Activities">
        <div className={p.outer}>
          <div className={p.header}>
            <div>
              <h2 className={p.title}>PRC Activities</h2>
              <p className={p.subtitle}>
                Staff calendar — click a date to add an event, or an event chip to view, edit, or delete. Use the toolbar
                to change months.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreate(toDateKey(new Date()))}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Add activity
            </button>
          </div>

          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
              <label className={labelCls} htmlFor="prc-dash-search">
                Search
              </label>
              <input
                id="prc-dash-search"
                type="search"
                placeholder="Filter by title or description…"
                className={inputCls}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className={labelCls}>Show</span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'month', label: 'This month' },
                  { id: 'upcoming', label: 'Upcoming' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScopeFilter(opt.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      scopeFilter === opt.id ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="px-5 py-3 text-sm text-red-700 sm:px-6">{error}</p>
          )}

          <div className="p-5 lg:p-6">
            <div className="min-w-0">
              <div className="prc-fc overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm ring-1 ring-slate-100/80 sm:p-3">
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: '',
                  }}
                  firstDay={0}
                  height="auto"
                  aspectRatio={1.5}
                  dayMaxEvents={4}
                  events={calendarEvents}
                  dateClick={(arg) => openCreate(arg.dateStr)}
                  eventClick={(info) => {
                    info.jsEvent.preventDefault()
                    const act = info.event.extendedProps.activity
                    if (act) openView(act)
                  }}
                  datesSet={(arg) => {
                    const start = arg.view.currentStart
                    setViewYear(start.getFullYear())
                    setViewMonth(start.getMonth())
                  }}
                  buttonText={{
                    today: 'Today',
                  }}
                  eventDisplay="block"
                  displayEventTime={false}
                />
              </div>
              {loading && (
                <p className="mt-3 text-center text-sm text-slate-500">Loading activities…</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {modal?.mode === 'view' && modal.activity && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-3xl"
          >
            <h2 className="text-lg font-bold text-slate-900">{modal.activity.title}</h2>
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date & time added</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTimeAdded(modal.activity.created_at)}</p>
            </div>
            <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {modal.activity.description || 'No description.'}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(modal.activity)}
                className="inline-flex flex-1 min-w-[120px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => requestDelete(modal.activity)}
                className="inline-flex flex-1 min-w-[120px] items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.mode === 'form' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={closeModal} />
          <form
            onSubmit={handleSubmitForm}
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold text-slate-900">{modal.editingId ? 'Edit activity' : 'New activity'}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelCls} htmlFor="prc-dash-act-title">
                  Activity title
                </label>
                <input
                  id="prc-dash-act-title"
                  className={inputCls}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="prc-dash-act-desc">
                  Description
                </label>
                <textarea
                  id="prc-dash-act-desc"
                  rows={4}
                  className={`${inputCls} resize-y`}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Details for your team…"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="prc-dash-act-date">
                  Date
                </label>
                <input
                  id="prc-dash-act-date"
                  type="date"
                  className={inputCls}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : modal.editingId ? 'Save changes' : 'Create activity'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
