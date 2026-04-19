import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from '../api.js'
import { adminPanel } from './admin-ui.jsx'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const GENDERS = [
  { value: '', label: '—' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
]

const REMARKS_OPTIONS = [
  { value: 'S', label: 'S' },
  { value: 'D', label: 'D' },
]
const DONATION_TYPE_OPTIONS = [
  { value: 'first_timer', label: 'First timer' },
  { value: 'repeater', label: 'Repeater' },
]

const AGE_GROUPS = [
  { label: '16-17', min: 16, max: 17 },
  { label: '18-20', min: 18, max: 20 },
  { label: '21-30', min: 21, max: 30 },
  { label: '31-40', min: 31, max: 40 },
  { label: '41-50', min: 41, max: 50 },
  { label: '51-60', min: 51, max: 60 },
  { label: '61-65', min: 61, max: 65 },
]

const BAG_GROUPS = ['Triple Bag', 'Double Bag', 'Single Bag', 'Other']

function normalizeBagGroup(value) {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('triple')) return 'Triple Bag'
  if (raw.includes('double')) return 'Double Bag'
  if (raw.includes('single')) return 'Single Bag'
  return 'Other'
}

function formatEventDate(value) {
  if (!value) return '—'
  const dayPart = String(value).split('T')[0]
  const d = new Date(`${dayPart}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const emptyCreateForm = () => ({
  name: '',
  organizerName: '',
  eventDate: '',
  location: '',
})

const emptyDonorForm = () => ({
  donorName: '',
  barcode: '',
  bloodType: 'O+',
  donorNumber: '',
  age: '',
  gender: '',
  bagType: '',
  remarksSd: 'S',
  donationType: 'first_timer',
  numDonations: '1',
})

function AdminMbd() {
  const p = adminPanel.rose
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [donors, setDonors] = useState([])
  const [donorsLoading, setDonorsLoading] = useState(false)
  const [donorForm, setDonorForm] = useState(emptyDonorForm)
  const [donorSaving, setDonorSaving] = useState(false)
  const [editingDonorId, setEditingDonorId] = useState(null)
  const [notification, setNotification] = useState(null)

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const loadEvents = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest('/api/admin/mbd-events')
      setEvents(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Failed to load MBD events')
      setEvents([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await loadEvents()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadEvents])

  const openModal = async (row) => {
    setSelectedEvent(row)
    setModalOpen(true)
    setEditingDonorId(null)
    setDonorForm(emptyDonorForm())
    setDonorsLoading(true)
    try {
      const data = await apiRequest(`/api/admin/mbd-events/${row.id}/donors`)
      setDonors(Array.isArray(data) ? data : [])
    } catch (e) {
      showNotification(e.message || 'Failed to load donors', 'destructive')
      setDonors([])
    } finally {
      setDonorsLoading(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedEvent(null)
    setDonors([])
    setEditingDonorId(null)
    setDonorForm(emptyDonorForm())
  }

  const handleCreateMbd = async (e) => {
    e.preventDefault()
    if (!createForm.name.trim() || !createForm.organizerName.trim() || !createForm.eventDate || !createForm.location.trim()) {
      showNotification('Fill in MBD name, organizer, date, and location.', 'destructive')
      return
    }
    setCreating(true)
    try {
      await apiRequest('/api/admin/mbd-events', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          organizerName: createForm.organizerName.trim(),
          eventDate: createForm.eventDate,
          location: createForm.location.trim(),
        }),
      })
      setCreateForm(emptyCreateForm())
      await loadEvents()
      showNotification('MBD event created.', 'primary')
    } catch (err) {
      showNotification(err.message || 'Could not create MBD', 'destructive')
    } finally {
      setCreating(false)
    }
  }

  const donorPayload = () => ({
    donorName: donorForm.donorName.trim(),
    barcode: donorForm.barcode.trim(),
    bloodType: donorForm.bloodType,
    donorNumber: donorForm.donorNumber.trim(),
    age: donorForm.age === '' ? '' : Number(donorForm.age),
    gender: donorForm.gender,
    bagType: donorForm.bagType.trim(),
    remarksSd: donorForm.remarksSd,
    numDonations:
      donorForm.donationType === 'repeater'
        ? Math.max(2, donorForm.numDonations === '' ? 2 : Number(donorForm.numDonations))
        : 1,
  })

  const handleSaveDonor = async (e) => {
    e.preventDefault()
    if (!selectedEvent) return
    if (!donorForm.donorName.trim()) {
      showNotification('Donor name is required.', 'destructive')
      return
    }
    setDonorSaving(true)
    try {
      const body = donorPayload()
      if (editingDonorId) {
        await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors/${editingDonorId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        showNotification('Donor updated.', 'primary')
      } else {
        await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        showNotification('Donor added.', 'primary')
      }
      setEditingDonorId(null)
      setDonorForm(emptyDonorForm())
      const data = await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors`)
      setDonors(Array.isArray(data) ? data : [])
      await loadEvents()
    } catch (err) {
      showNotification(err.message || 'Could not save donor', 'destructive')
    } finally {
      setDonorSaving(false)
    }
  }

  const startEditDonor = (d) => {
    setEditingDonorId(d.id)
    setDonorForm({
      donorName: d.donor_name || '',
      barcode: d.barcode || '',
      bloodType: d.blood_type || 'O+',
      donorNumber: d.donor_number || '',
      age: d.age != null ? String(d.age) : '',
      gender: d.gender || '',
      bagType: d.bag_type || '',
      remarksSd: d.remarks_sd || 'S',
      donationType: Number(d.num_donations) > 1 ? 'repeater' : 'first_timer',
      numDonations: d.num_donations != null ? String(d.num_donations) : '1',
    })
  }

  const cancelEditDonor = () => {
    setEditingDonorId(null)
    setDonorForm(emptyDonorForm())
  }

  const deleteDonor = async (d) => {
    if (!selectedEvent) return
    if (!window.confirm(`Remove donor record for "${d.donor_name}"?`)) return
    try {
      await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors/${d.id}`, { method: 'DELETE' })
      showNotification('Donor removed.', 'primary')
      const data = await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors`)
      setDonors(Array.isArray(data) ? data : [])
      await loadEvents()
      if (editingDonorId === d.id) cancelEditDonor()
    } catch (err) {
      showNotification(err.message || 'Could not delete donor', 'destructive')
    }
  }

  const inputCls =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200'

  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-600'
  const summary = useMemo(() => {
    const bloodTypeCounts = Object.fromEntries(BLOOD_TYPES.map((type) => [type, 0]))
    const ageGroupCounts = Object.fromEntries(AGE_GROUPS.map((group) => [group.label, 0]))
    const sexCounts = { Male: 0, Female: 0, Other: 0, Unspecified: 0 }
    const remarksCounts = { S: 0, D: 0 }
    const donationCounts = { firstTimer: 0, repeater: 0 }
    const bagByType = {}
    BAG_GROUPS.forEach((bag) => {
      bagByType[bag] = Object.fromEntries(BLOOD_TYPES.map((type) => [type, 0]))
    })

    donors.forEach((donor) => {
      const bt = BLOOD_TYPES.includes(donor.blood_type) ? donor.blood_type : null
      if (bt) bloodTypeCounts[bt] += 1

      const age = Number(donor.age)
      if (Number.isFinite(age)) {
        const hit = AGE_GROUPS.find((group) => age >= group.min && age <= group.max)
        if (hit) ageGroupCounts[hit.label] += 1
      }

      const sx = String(donor.gender || '').toLowerCase()
      if (sx === 'male') sexCounts.Male += 1
      else if (sx === 'female') sexCounts.Female += 1
      else if (sx) sexCounts.Other += 1
      else sexCounts.Unspecified += 1

      const rk = String(donor.remarks_sd || '').toUpperCase()
      if (rk === 'S') remarksCounts.S += 1
      if (rk === 'D') remarksCounts.D += 1

      const donationNumber = Number(donor.num_donations)
      if (Number.isFinite(donationNumber) && donationNumber > 1) donationCounts.repeater += 1
      else donationCounts.firstTimer += 1

      const bag = normalizeBagGroup(donor.bag_type)
      if (bt) bagByType[bag][bt] += 1
    })

    const bagTotals = {}
    BAG_GROUPS.forEach((bag) => {
      bagTotals[bag] = BLOOD_TYPES.reduce((acc, bt) => acc + bagByType[bag][bt], 0)
    })

    return {
      total: donors.length,
      bloodTypeCounts,
      ageGroupCounts,
      sexCounts,
      remarksCounts,
      donationCounts,
      bagByType,
      bagTotals,
    }
  }, [donors])

  const printSummaryReport = () => {
    if (!selectedEvent) return
    const printableRows = donors.map((d, idx) => ({
      no: idx + 1,
      barcode: d.barcode || '',
      bt: d.blood_type || '',
      donorNumber: d.donor_number || '',
      age: d.age != null ? d.age : '',
      sex: d.gender || '',
      bag: d.bag_type || '',
      remarks: d.remarks_sd || '',
      donation: Number.isFinite(Number(d.num_donations)) ? `${Number(d.num_donations)}X` : '',
    }))

    const summaryBloodRows = BLOOD_TYPES.map(
      (bt) => `<tr><td>${bt}</td><td class="num">${summary.bloodTypeCounts[bt]}</td></tr>`,
    ).join('')
    const ageRows = AGE_GROUPS.map(
      (g) => `<tr><td>${g.label}</td><td class="num">${summary.ageGroupCounts[g.label]}</td></tr>`,
    ).join('')
    const donorRows = printableRows
      .map(
        (row) => `
        <tr>
          <td class="num">${row.no}</td>
          <td>${escapeHtml(row.barcode)}</td>
          <td>${escapeHtml(row.bt)}</td>
          <td>${escapeHtml(row.donorNumber)}</td>
          <td class="num">${escapeHtml(row.age)}</td>
          <td>${escapeHtml(row.sex)}</td>
          <td>${escapeHtml(row.bag)}</td>
          <td>${escapeHtml(row.remarks)}</td>
          <td>${escapeHtml(row.donation)}</td>
        </tr>
      `,
      )
      .join('')

    const bagRows = BAG_GROUPS.map((bag) => {
      const cells = BLOOD_TYPES.map((bt) => `<td class="num">${summary.bagByType[bag][bt]}</td>`).join('')
      return `<tr><td>${bag}</td>${cells}<td class="num">${summary.bagTotals[bag]}</td></tr>`
    }).join('')

    const printHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>MBD Summary Report</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 20px; color: #111; }
            h1 { text-align: center; font-size: 18px; margin: 0 0 10px; letter-spacing: .03em; }
            .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
            .meta div { min-width: 230px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #222; padding: 4px 6px; vertical-align: middle; }
            th { background: #f3f4f6; font-weight: 700; }
            .num { text-align: right; }
            .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-bottom: 10px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
            .tight th, .tight td { padding: 3px 5px; }
            .section-title { font-size: 12px; font-weight: 700; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: .03em; }
            @media print {
              body { margin: 12mm; }
              @page { size: A4 portrait; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <h1>BLOOD COLLECTION SUMMARY REPORT</h1>
          <div class="meta">
            <div><strong>DATE:</strong> ${escapeHtml(formatEventDate(selectedEvent.event_date))}</div>
            <div><strong>VENUE:</strong> ${escapeHtml(selectedEvent.location)}</div>
            <div><strong>EVENT:</strong> ${escapeHtml(selectedEvent.name)}</div>
            <div><strong>ORGANIZER:</strong> ${escapeHtml(selectedEvent.organizer_name || '')}</div>
          </div>

          <div class="grid">
            <table class="tight">
              <thead><tr><th>BLOOD TYPE</th><th class="num">TOTAL</th></tr></thead>
              <tbody>
                ${summaryBloodRows}
                <tr><td><strong>TOTAL</strong></td><td class="num"><strong>${summary.total}</strong></td></tr>
              </tbody>
            </table>
            <table class="tight">
              <thead><tr><th>BY AGE</th><th class="num">TOTAL</th></tr></thead>
              <tbody>
                ${ageRows}
                <tr><td><strong>TOTAL</strong></td><td class="num"><strong>${summary.total}</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div class="grid-3">
            <table class="tight">
              <thead><tr><th>SEX DISTRIBUTION</th><th class="num">TOTAL</th></tr></thead>
              <tbody>
                <tr><td>Male</td><td class="num">${summary.sexCounts.Male}</td></tr>
                <tr><td>Female</td><td class="num">${summary.sexCounts.Female}</td></tr>
                <tr><td>Other/Unspecified</td><td class="num">${summary.sexCounts.Other + summary.sexCounts.Unspecified}</td></tr>
                <tr><td><strong>TOTAL</strong></td><td class="num"><strong>${summary.total}</strong></td></tr>
              </tbody>
            </table>
            <table class="tight">
              <thead><tr><th>NO. OF DONATION</th><th class="num">TOTAL</th></tr></thead>
              <tbody>
                <tr><td>First timer</td><td class="num">${summary.donationCounts.firstTimer}</td></tr>
                <tr><td>Repeater</td><td class="num">${summary.donationCounts.repeater}</td></tr>
                <tr><td><strong>TOTAL</strong></td><td class="num"><strong>${summary.total}</strong></td></tr>
              </tbody>
            </table>
            <table class="tight">
              <thead><tr><th>REMARKS</th><th class="num">TOTAL</th></tr></thead>
              <tbody>
                <tr><td>S</td><td class="num">${summary.remarksCounts.S}</td></tr>
                <tr><td>D</td><td class="num">${summary.remarksCounts.D}</td></tr>
                <tr><td><strong>TOTAL</strong></td><td class="num"><strong>${summary.total}</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div class="section-title">Bag Type Breakdown</div>
          <table class="tight">
            <thead>
              <tr>
                <th>BAG TYPE</th>
                ${BLOOD_TYPES.map((bt) => `<th class="num">${bt}</th>`).join('')}
                <th class="num">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${bagRows}
              <tr>
                <td><strong>TOTAL</strong></td>
                ${BLOOD_TYPES.map((bt) => `<td class="num"><strong>${summary.bloodTypeCounts[bt]}</strong></td>`).join('')}
                <td class="num"><strong>${summary.total}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Donor List</div>
          <table>
            <thead>
              <tr>
                <th style="width:40px">#</th>
                <th>BARCODE</th>
                <th>BT</th>
                <th>ID</th>
                <th>AGE</th>
                <th>SEX</th>
                <th>BAG</th>
                <th>REMARKS</th>
                <th>DONATION</th>
              </tr>
            </thead>
            <tbody>
              ${donorRows || '<tr><td colspan="9" style="text-align:center">No donor records.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    iframe.onload = () => {
      try {
        const frameWindow = iframe.contentWindow
        if (!frameWindow) {
          showNotification('Failed to open print dialog.', 'destructive')
          return
        }
        frameWindow.focus()
        frameWindow.print()
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
        }, 1000)
      }
    }

    iframe.srcdoc = printHtml
  }

  return (
    <AdminLayout
      pageTitle="MBD (Mobile Blood Donation)"
      pageDescription="Create donation drives and record donors collected during each mobile blood donation event."
    >
      <div className={p.outer}>
        <div className={p.header}>
          <div>
            <h2 className={p.title}>Create MBD event</h2>
            <p className={p.subtitle}>Add a drive before recording donor intake for that date and location.</p>
          </div>
        </div>
        <form onSubmit={handleCreateMbd} className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls} htmlFor="mbd-name">
                MBD name
              </label>
              <input
                id="mbd-name"
                className={inputCls}
                value={createForm.name}
                onChange={(ev) => setCreateForm((f) => ({ ...f, name: ev.target.value }))}
                placeholder="e.g. City Hall drive"
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="mbd-organizer">
                Organizer name
              </label>
              <input
                id="mbd-organizer"
                className={inputCls}
                value={createForm.organizerName}
                onChange={(ev) => setCreateForm((f) => ({ ...f, organizerName: ev.target.value }))}
                placeholder="Organization or contact person"
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="mbd-date">
                Date of event
              </label>
              <input
                id="mbd-date"
                type="date"
                className={inputCls}
                value={createForm.eventDate}
                onChange={(ev) => setCreateForm((f) => ({ ...f, eventDate: ev.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="mbd-loc">
                Location
              </label>
              <input
                id="mbd-loc"
                className={inputCls}
                value={createForm.location}
                onChange={(ev) => setCreateForm((f) => ({ ...f, location: ev.target.value }))}
                placeholder="Venue or address"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create MBD'}
            </button>
          </div>
        </form>

        <div className={p.header}>
          <div>
            <h2 className={p.title}>MBD events</h2>
            <p className={p.subtitle}>Click a row to open donor management for that drive.</p>
          </div>
        </div>
        {error && (
          <p className="px-5 py-4 text-sm text-red-700 sm:px-6">{error}</p>
        )}
        <div className={p.tableScroll}>
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className={p.thead}>
              <tr>
                <th className={`${p.th} px-4 py-3`}>MBD name</th>
                <th className={`${p.th} px-4 py-3`}>Organizer</th>
                <th className={`${p.th} px-4 py-3`}>Date</th>
                <th className={`${p.th} px-4 py-3`}>Location</th>
                <th className={`${p.th} px-4 py-3 text-right`}>Donors</th>
              </tr>
            </thead>
            <tbody className={p.tbody}>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No MBD events yet. Create one above.
                  </td>
                </tr>
              )}
              {!loading &&
                events.map((row) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openModal(row)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault()
                        openModal(row)
                      }
                    }}
                    className="cursor-pointer transition hover:bg-red-50/60 focus:bg-red-50/60 focus:outline-none"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={row.organizer_name || ''}>
                      {row.organizer_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatEventDate(row.event_date)}</td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-slate-700" title={row.location}>
                      {row.location}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{row.donor_count ?? 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && selectedEvent && (
        <div className="fixed inset-0 z-90 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={closeModal} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mbd-modal-title"
            className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-[1.35rem] bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Mobile blood donation</p>
                <h2 id="mbd-modal-title" className="mt-1 truncate text-lg font-bold text-slate-900 sm:text-xl">
                  {selectedEvent.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {formatEventDate(selectedEvent.event_date)}
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="text-slate-700">{selectedEvent.location}</span>
                </p>
                {(selectedEvent.organizer_name || '').trim() ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Organizer: <span className="font-medium text-slate-800">{selectedEvent.organizer_name}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={printSummaryReport}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                >
                  Print / Save PDF
                </button>
              </div>

              <form onSubmit={handleSaveDonor} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingDonorId ? 'Edit donor' : 'Add donor'}
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className={labelCls} htmlFor="donor-name">
                      Donor name
                    </label>
                    <input
                      id="donor-name"
                      className={inputCls}
                      value={donorForm.donorName}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, donorName: ev.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-barcode">
                      Barcode
                    </label>
                    <input
                      id="donor-barcode"
                      className={inputCls}
                      value={donorForm.barcode}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, barcode: ev.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-bt">
                      Blood type
                    </label>
                    <select
                      id="donor-bt"
                      className={inputCls}
                      value={donorForm.bloodType}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, bloodType: ev.target.value }))}
                    >
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-num">
                      Donor number
                    </label>
                    <input
                      id="donor-num"
                      className={inputCls}
                      value={donorForm.donorNumber}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, donorNumber: ev.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-age">
                      Age
                    </label>
                    <input
                      id="donor-age"
                      type="number"
                      min={0}
                      max={130}
                      className={inputCls}
                      value={donorForm.age}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, age: ev.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-gender">
                      Gender
                    </label>
                    <select
                      id="donor-gender"
                      className={inputCls}
                      value={donorForm.gender}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, gender: ev.target.value }))}
                    >
                      {GENDERS.map((g) => (
                        <option key={g.value || 'unset'} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-bag">
                      Bag type
                    </label>
                    <input
                      id="donor-bag"
                      className={inputCls}
                      value={donorForm.bagType}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, bagType: ev.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-remarks">
                      Remarks (S or D)
                    </label>
                    <select
                      id="donor-remarks"
                      className={inputCls}
                      value={donorForm.remarksSd}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, remarksSd: ev.target.value }))}
                    >
                      {REMARKS_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-type">
                      Donation type
                    </label>
                    <select
                      id="donor-type"
                      className={inputCls}
                      value={donorForm.donationType}
                      onChange={(ev) => {
                        const nextType = ev.target.value
                        setDonorForm((f) => ({
                          ...f,
                          donationType: nextType,
                          numDonations:
                            nextType === 'first_timer'
                              ? '1'
                              : f.numDonations && Number(f.numDonations) > 1
                                ? f.numDonations
                                : '2',
                        }))
                      }}
                    >
                      {DONATION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-nd">
                      Number of donations
                    </label>
                    <input
                      id="donor-nd"
                      type="number"
                      min={donorForm.donationType === 'repeater' ? 2 : 1}
                      className={inputCls}
                      value={donorForm.numDonations}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, numDonations: ev.target.value }))}
                      disabled={donorForm.donationType === 'first_timer'}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={donorSaving}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    {donorSaving ? 'Saving…' : editingDonorId ? 'Update donor' : 'Add donor'}
                  </button>
                  {editingDonorId && (
                    <button
                      type="button"
                      onClick={cancelEditDonor}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>

              <h3 className="mt-8 text-sm font-semibold text-slate-900">Donors for this event</h3>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100/85">
                    <tr>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Name</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Barcode</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Type</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">No.</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Age</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Gender</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Bag</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Rmk</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600"># Don.</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {donorsLoading && (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                          Loading donors…
                        </td>
                      </tr>
                    )}
                    {!donorsLoading && donors.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                          No donors recorded yet for this MBD.
                        </td>
                      </tr>
                    )}
                    {!donorsLoading &&
                      donors.map((d) => (
                        <tr key={d.id} className={editingDonorId === d.id ? 'bg-red-50/50' : ''}>
                          <td className="px-3 py-2 font-medium text-slate-900">{d.donor_name}</td>
                          <td className="px-3 py-2 text-slate-700">{d.barcode || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{d.blood_type}</td>
                          <td className="px-3 py-2 text-slate-700">{d.donor_number || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{d.age != null ? d.age : '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{d.gender || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{d.bag_type || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{d.remarks_sd}</td>
                          <td className="px-3 py-2 text-slate-700">{d.num_donations}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                startEditDonor(d)
                              }}
                              className="mr-2 text-xs font-semibold text-red-700 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                deleteDonor(d)
                              }}
                              className="text-xs font-semibold text-slate-600 hover:text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {notification && (
        <div className="fixed right-4 top-4 z-95 transition-all duration-300 ease-in-out">
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

export default AdminMbd
