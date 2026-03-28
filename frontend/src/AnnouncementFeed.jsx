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
  const base =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1'
  if (urgent) {
    return (
      <span className={`${base} bg-red-50 text-red-800 ring-red-200/80`}>
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        Urgent
      </span>
    )
  }
  if (drive) {
    return (
      <span className={`${base} bg-rose-50 text-rose-900 ring-rose-200/80`}>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Blood drive
      </span>
    )
  }
  return (
    <span className={`${base} bg-slate-100 text-slate-700 ring-slate-200/80`}>
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      General
    </span>
  )
}

function StatusPill({ status }) {
  const on = status === 'ongoing'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
        on ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/90' : 'bg-sky-50 text-sky-800 ring-sky-200/90'
      }`}
    >
      {on ? 'Live' : 'Upcoming'}
    </span>
  )
}

function AnnouncementDetailModal({ announcement, onClose }) {
  if (!announcement) return null
  const urgent = announcement.announcement_type === 'urgent_need'
  const mapLink = mapsUrl(announcement.location)

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[min(92vh,600px)] w-full max-w-md flex-col overflow-hidden rounded-t-[1.35rem] bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-200/80 sm:max-h-[min(88vh,560px)] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ann-modal-title"
      >
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="relative border-b border-slate-100 bg-white px-5 pb-6 pt-4 sm:rounded-t-3xl sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <TypeBadge type={announcement.announcement_type} />
              <StatusPill status={announcement.status} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h2
            id="ann-modal-title"
            className={`mt-4 text-xl font-bold leading-tight tracking-tight sm:text-2xl ${urgent ? 'text-red-950' : 'text-slate-900'}`}
          >
            {announcement.title}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 whitespace-pre-wrap">
            {announcement.description || 'No description provided.'}
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 ring-1 ring-slate-100/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm ring-1 ring-slate-200/60">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">When</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatEventDate(announcement.event_starts_at)}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 ring-1 ring-slate-100/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm ring-1 ring-slate-200/60">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Where</p>
                {announcement.location ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-red-700 underline decoration-red-200 underline-offset-2 transition hover:text-red-800"
                  >
                    {announcement.location}
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-slate-400">Not specified</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2"
          >
            Done
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
          className="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-[2px] transition-opacity"
          aria-label="Close announcements panel"
          onClick={onClose}
        />
      )}

      <aside
        id="announcements-side-panel"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-slate-200/80 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.25)] transition-transform duration-300 ease-out sm:max-w-[420px] ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div className="relative flex shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-slate-100 bg-gradient-to-br from-red-600 via-red-600 to-rose-800 px-4 py-4 pr-3 sm:px-5">
          <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M20 20h20v20H20zM0 0h20v20H0z\'/%3E%3C/g%3E%3C/svg%3E')]" />
          <div className="relative flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner ring-2 ring-white/25">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 001.759 1.759h.282a1.76 1.76 0 001.759-1.759V5.882M12 5.882V4.5M9.5 9h5"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-white">Announcements</h2>
              <p className="text-xs font-medium text-red-100">Blood drives &amp; urgent needs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Close panel"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/50 px-4 py-5 sm:px-5">
          {loading && (
            <ul className="flex flex-col gap-4" aria-busy="true" aria-label="Loading announcements">
              {[1, 2, 3].map((i) => (
                <li key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                  <div className="h-5 w-24 rounded-full bg-slate-200" />
                  <div className="mt-3 h-4 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="mt-4 h-10 w-full rounded-xl bg-slate-100" />
                </li>
              ))}
            </ul>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">You&apos;re all caught up</p>
              <p className="mt-1 max-w-[240px] text-sm leading-relaxed text-slate-500">
                There are no active announcements right now. Check back for drives and urgent needs.
              </p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <ul className="flex flex-col gap-4">
              {items.map((a) => {
                const urgent = a.announcement_type === 'urgent_need'
                return (
                  <li
                    key={a.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/80 transition hover:shadow-md hover:ring-slate-200"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={a.announcement_type} />
                      <StatusPill status={a.status} />
                    </div>
                    <h3 className={`mt-2.5 text-[15px] font-bold leading-snug tracking-tight ${urgent ? 'text-red-950' : 'text-slate-900'}`}>
                      {a.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {formatEventDate(a.event_starts_at)}
                      </span>
                      {a.location ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-600">
                          <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="line-clamp-1">{a.location}</span>
                        </span>
                      ) : null}
                    </div>
                    {a.description ? (
                      <p className="mt-3 text-[13px] leading-relaxed text-slate-600 line-clamp-3">{truncate(a.description, 160)}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDetail(a)}
                      className="mt-4 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white shadow-md shadow-slate-900/10 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
                    >
                      View details
                      <svg className="h-4 w-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
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
