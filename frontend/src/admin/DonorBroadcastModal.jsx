import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api.js'
import ConfirmDialog from '../ConfirmDialog.jsx'

const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/**
 * Admin modal: compose in-app notifications to donors with eligibility + blood-type targeting.
 */
export default function DonorBroadcastModal({ open, onClose }) {
  const [tab, setTab] = useState('compose')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  /** 'eligible' = 90-day whole-blood rule (matches donor list); 'all_active' = any active donor */
  const [donorPool, setDonorPool] = useState('eligible')
  /** 'all' | 'single' | 'multi' */
  const [bloodScope, setBloodScope] = useState('all')
  const [singleBloodType, setSingleBloodType] = useState('O+')
  const [multiBloodTypes, setMultiBloodTypes] = useState(() => new Set(['O+', 'A+']))

  const [previewCount, setPreviewCount] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const [sendLoading, setSendLoading] = useState(false)
  const [successBanner, setSuccessBanner] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const eligibleOnly = donorPool === 'eligible'

  const bloodTypesPayload = useMemo(() => {
    if (bloodScope === 'all') return null
    if (bloodScope === 'single') return [singleBloodType]
    return Array.from(multiBloodTypes)
  }, [bloodScope, singleBloodType, multiBloodTypes])

  const toggleMultiType = (bt) => {
    setMultiBloodTypes((prev) => {
      const next = new Set(prev)
      if (next.has(bt)) next.delete(bt)
      else next.add(bt)
      return next
    })
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const rows = await apiRequest('/api/admin/donors/notify/history?limit=50')
      setHistory(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setHistoryError(e.message || 'Failed to load history')
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && tab === 'history') {
      loadHistory()
    }
  }, [open, tab, loadHistory])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const t = setTimeout(async () => {
      if (bloodScope === 'multi' && multiBloodTypes.size === 0) {
        setPreviewCount(null)
        setPreviewError('Select at least one blood type')
        setPreviewLoading(false)
        return
      }
      setPreviewLoading(true)
      setPreviewError('')
      try {
        const body = {
          eligibleOnly,
          bloodTypes: bloodTypesPayload,
        }
        const result = await apiRequest('/api/admin/donors/notify/preview', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        if (!cancelled) {
          setPreviewCount(typeof result?.count === 'number' ? result.count : 0)
        }
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e.message || 'Could not load recipient count')
          setPreviewCount(null)
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, eligibleOnly, bloodTypesPayload, bloodScope, multiBloodTypes])

  useEffect(() => {
    if (!open) {
      setSuccessBanner('')
      setTab('compose')
    }
  }, [open])

  const canSend =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    !(bloodScope === 'multi' && multiBloodTypes.size === 0) &&
    previewCount !== null &&
    previewCount > 0 &&
    !previewLoading &&
    !previewError

  const handleSendClick = () => {
    if (!canSend) return
    setConfirmOpen(true)
  }

  const handleConfirmSend = async () => {
    setSendLoading(true)
    try {
      await apiRequest('/api/admin/donors/notify/send', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          eligibleOnly,
          bloodTypes: bloodTypesPayload,
        }),
      })
      setConfirmOpen(false)
      setSuccessBanner('Notification sent successfully. Donors will see it in their account.')
      setTitle('')
      setMessage('')
      loadHistory()
    } catch (e) {
      setConfirmOpen(false)
      setPreviewError(e.message || 'Send failed')
    } finally {
      setSendLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] sm:items-center">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="donor-broadcast-title"
          className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-linear-to-r from-rose-50 to-white px-5 py-4">
            <div>
              <h2 id="donor-broadcast-title" className="text-lg font-bold text-slate-900">
                Send notification to donors
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Deliver in-app messages for urgent requests, drives, announcements, or reminders.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close dialog"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
            <button
              type="button"
              onClick={() => setTab('compose')}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
                tab === 'compose'
                  ? 'border border-b-0 border-slate-200 bg-white text-rose-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compose
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
                tab === 'history'
                  ? 'border border-b-0 border-slate-200 bg-white text-rose-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              History
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {successBanner && (
              <div
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
                role="status"
              >
                {successBanner}
              </div>
            )}

            {tab === 'compose' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="bc-title" className="block text-sm font-semibold text-slate-800">
                    Message title
                  </label>
                  <input
                    id="bc-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={255}
                    placeholder="e.g. Urgent: O+ needed at City Hospital"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="bc-body" className="block text-sm font-semibold text-slate-800">
                    Message content
                  </label>
                  <textarea
                    id="bc-body"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    maxLength={8000}
                    placeholder="Write a clear, actionable message. Donors will see this in their notifications."
                    className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <p className="mt-1 text-xs text-slate-500">{message.length} / 8000</p>
                </div>

                <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">Who should receive this?</legend>
                  <div className="mt-3 space-y-3">
                    <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-white">
                      <input
                        type="radio"
                        name="donorPool"
                        checked={donorPool === 'eligible'}
                        onChange={() => setDonorPool('eligible')}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold text-slate-900">All available donors (eligible only)</span>
                        <span className="mt-0.5 block text-sm text-slate-600">
                          Uses the same 90-day whole-blood rule as the donor list — only donors who can donate now.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-white">
                      <input
                        type="radio"
                        name="donorPool"
                        checked={donorPool === 'all_active'}
                        onChange={() => setDonorPool('all_active')}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold text-slate-900">All active donors (all blood types, ignore cooldown)</span>
                        <span className="mt-0.5 block text-sm text-slate-600">
                          For general announcements; includes donors still in the donation waiting period.
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">Blood type targeting</legend>
                  <div className="mt-3 space-y-3">
                    <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="bloodScope"
                        checked={bloodScope === 'all'}
                        onChange={() => setBloodScope('all')}
                        className="mt-1"
                      />
                      <span className="font-medium text-slate-900">All blood types (no filter)</span>
                    </label>
                    <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="bloodScope"
                        checked={bloodScope === 'single'}
                        onChange={() => setBloodScope('single')}
                        className="mt-1"
                      />
                      <span className="flex flex-1 flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">Specific blood type</span>
                        <select
                          value={singleBloodType}
                          onChange={(e) => setSingleBloodType(e.target.value)}
                          disabled={bloodScope !== 'single'}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-50"
                        >
                          {BLOOD_TYPE_OPTIONS.map((bt) => (
                            <option key={bt} value={bt}>
                              {bt}
                            </option>
                          ))}
                        </select>
                      </span>
                    </label>
                    <div>
                      <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="bloodScope"
                          checked={bloodScope === 'multi'}
                          onChange={() => setBloodScope('multi')}
                          className="mt-1"
                        />
                        <span className="font-medium text-slate-900">Multiple blood types</span>
                      </label>
                      {bloodScope === 'multi' && (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {BLOOD_TYPE_OPTIONS.map((bt) => (
                            <label
                              key={bt}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-800 hover:bg-white"
                            >
                              <input
                                type="checkbox"
                                checked={multiBloodTypes.has(bt)}
                                onChange={() => toggleMultiType(bt)}
                              />
                              {bt}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </fieldset>

                <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3">
                  <p className="text-sm font-semibold text-rose-900">Recipients matching your criteria</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-rose-950">
                    {previewLoading ? (
                      <span className="text-base font-medium text-rose-800/80">Calculating…</span>
                    ) : previewError ? (
                      <span className="text-base font-medium text-red-700">{previewError}</span>
                    ) : (
                      (previewCount ?? '—').toString()
                    )}
                  </p>
                  <p className="mt-1 text-xs text-rose-800/90">
                    Only active donor accounts are included. Eligible-only mode matches the dashboard &quot;Available&quot;
                    column.
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pb-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendClick}
                    disabled={!canSend}
                    className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send notification
                  </button>
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div>
                {historyLoading && <p className="text-sm text-slate-500">Loading history…</p>}
                {historyError && <p className="text-sm text-red-600">{historyError}</p>}
                {!historyLoading && !historyError && history.length === 0 && (
                  <p className="text-sm text-slate-500">No broadcasts yet.</p>
                )}
                {!historyLoading && history.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Title</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Sent by</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">Recipients</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/80">
                            <td className="max-w-[200px] px-3 py-2 align-top">
                              <div className="font-semibold text-slate-900">{row.title}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-slate-600">{row.message}</div>
                              <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                                {row.eligibleOnly ? (
                                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
                                    Eligible only
                                  </span>
                                ) : (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                                    All active
                                  </span>
                                )}
                                {row.bloodTypes?.length ? (
                                  <span>Blood: {row.bloodTypes.join(', ')}</span>
                                ) : (
                                  <span>All blood types</span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.sentBy}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                              {row.totalRecipients}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                              {row.createdAt
                                ? new Date(row.createdAt).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Send notification?"
        message={`This will send an in-app notification to ${previewCount ?? 0} donor${
          previewCount === 1 ? '' : 's'
        }. This cannot be undone.`}
        confirmLabel="Send now"
        cancelLabel="Go back"
        loading={sendLoading}
        confirmTone="primary"
        onCancel={() => !sendLoading && setConfirmOpen(false)}
        onConfirm={handleConfirmSend}
      />
    </>
  )
}
