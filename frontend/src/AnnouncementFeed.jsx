import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'

function formatEventDate(value) {
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

function truncate(text, max) {
  if (!text) return ''
  const t = String(text).trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trim()}…`
}

function mapsUrl(loc) {
  if (!loc) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`
}

function TypeBadge({ type }) {
  const urgent = type === 'urgent_need'
  const drive = type === 'blood_drive'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
        urgent
          ? 'bg-red-100 text-red-800 ring-red-200'
          : drive
            ? 'bg-rose-50 text-rose-800 ring-rose-200'
            : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {urgent ? 'Urgent' : drive ? 'Blood drive' : 'General'}
    </span>
  )
}

function AnnouncementDetailModal({ announcement, onClose }) {
  if (!announcement) return null
  const urgent = announcement.announcement_type === 'urgent_need'
  const mapLink = mapsUrl(announcement.location)

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[min(90vh,560px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-white p-5 shadow-2xl sm:rounded-2xl ${
          urgent ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200 ring-1 ring-slate-100'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ann-modal-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={announcement.announcement_type} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
              {announcement.status === 'ongoing' ? 'Ongoing' : 'Upcoming'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h2 id="ann-modal-title" className={`mt-3 text-lg font-semibold leading-snug ${urgent ? 'text-red-950' : 'text-slate-900'}`}>
          {announcement.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
          {announcement.description || 'No description provided.'}
        </p>
        <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-medium text-slate-500">When</dt>
            <dd className="text-slate-800">{formatEventDate(announcement.event_starts_at)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-medium text-slate-500">Where</dt>
            <dd className="min-w-0 text-slate-800">
              {announcement.location ? (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-red-700 underline decoration-red-200 underline-offset-2 hover:text-red-800"
                >
                  {announcement.location}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Public announcements (no auth). Uses GET /api/announcements.
 */
async function fetchPublicAnnouncements({ limit, sort }) {
  const params = new URLSearchParams({
    limit: String(limit),
    sort,
    activeOnly: 'true',
  })
  return apiRequest(`/api/announcements?${params.toString()}`)
}

/** Slide-out right panel (donor dashboard & login) — stacked cards, open/close controlled by parent */
export function DashboardAnnouncementsPanel({ open, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchPublicAnnouncements({ limit: 3, sort: 'nearest' })
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) setDetail(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (detail) {
        setDetail(null)
      } else {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, detail])

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
          aria-label="Close announcements panel"
          onClick={onClose}
        />
      )}

      <aside
        id="announcements-side-panel"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-slate-200/90 bg-white shadow-2xl transition-transform duration-300 ease-out sm:max-w-[400px] ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 pr-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 001.759 1.759h.282a1.76 1.76 0 001.759-1.759V5.882M12 5.882V4.5M9.5 9h5"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Announcements</h2>
              <p className="text-[11px] text-slate-500">Blood drives &amp; urgent needs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            aria-label="Close panel"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {loading && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}

          {!loading && items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No active announcements right now.</p>
          )}

          {!loading && items.length > 0 && (
            <ul className="flex flex-col gap-4">
              {items.map((a) => {
                const urgent = a.announcement_type === 'urgent_need'
                return (
                  <li
                    key={a.id}
                    className={`rounded-xl border p-4 shadow-sm ${
                      urgent
                        ? 'border-red-200 bg-linear-to-br from-red-50/90 to-white ring-1 ring-red-100/80'
                        : 'border-slate-100 bg-slate-50/40 ring-1 ring-slate-100/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={a.announcement_type} />
                    </div>
                    <h3 className={`mt-2 text-sm font-semibold leading-snug ${urgent ? 'text-red-950' : 'text-slate-900'}`}>
                      {a.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500">{formatEventDate(a.event_starts_at)}</p>
                    {a.location ? (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                        <span className="font-medium text-slate-500">Location: </span>
                        {a.location}
                      </p>
                    ) : null}
                    {a.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-3">{truncate(a.description, 140)}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDetail(a)}
                      className="mt-3 inline-flex w-full min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
                    >
                      View details
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {detail && <AnnouncementDetailModal announcement={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
