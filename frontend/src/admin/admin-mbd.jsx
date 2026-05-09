import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from '../api.js'
import { adminPanel } from './admin-ui.jsx'

const DONOR_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const SUMMARY_BLOOD_TYPES = ['A', 'B', 'O', 'AB']

const GENDERS = [
  { value: '', label: '—' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
]

const DISCONTINUED_OPTIONS = [
  { value: '', label: '—' },
  { value: 'S', label: 'Single' },
  { value: 'D', label: 'Double' },
  { value: 'T', label: 'Triple' },
]
const DONATION_TYPE_OPTIONS = [
  { value: 'first_timer', label: 'First timer' },
  { value: 'repeater', label: 'Repeater' },
]
const BAG_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Single Bag', label: 'Single Bag' },
  { value: 'Double Bag', label: 'Double Bag' },
  { value: 'Triple Bag', label: 'Triple Bag' },
]
const DEFERRAL_FIELDS = [
  { key: 'low_hbg', label: 'LOW HBG' },
  { key: 'menstruation', label: 'MENSTRUATION' },
  { key: 'high_bp', label: 'HIGH BP' },
  { key: 'low_bp', label: 'LOW BP' },
  { key: 'vaccinations', label: 'VACCINATIONS' },
  { key: 'underweight', label: 'UNDERWEIGHT' },
  { key: 'tattoo_piercing', label: 'TATTOO/PIERCING' },
  { key: 'antibiotic_therapy_or_medication', label: 'ANTIBIOTIC THERAPY OR MEDICATION' },
  { key: 'less_than_3_months_from_last_donations', label: 'LESS THAN 3 MONTHS FROM LAST DONATIONS' },
  { key: 'surgical_operations', label: 'SURGICAL OPERATIONS' },
  { key: 'dental_extraction', label: 'DENTAL EXTRACTION' },
  { key: 'cough_colds', label: 'COUGH & COLDS' },
  { key: 'fever', label: 'FEVER' },
  { key: 'lack_of_sleep', label: 'LACK OF SLEEP' },
  { key: 'alcohol_intake_less_than_12_hrs', label: 'ALCOHOL INTAKE LESS THAN 12 HRS' },
  { key: 'other_medical_condition', label: 'OTHER MEDICAL CONDITION' },
  { key: 'others', label: 'OTHERS' },
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

const BAG_GROUPS = ['Single Bag', 'Double Bag', 'Triple Bag']

const emptyDeferralForm = () =>
  Object.fromEntries(DEFERRAL_FIELDS.map((field) => [field.key, '0']))

function normalizeBagGroup(value) {
  const raw = String(value || '').toLowerCase()
  if (!raw.trim()) return ''
  if (raw.includes('triple')) return 'Triple Bag'
  if (raw.includes('double')) return 'Double Bag'
  return 'Single Bag'
}

function normalizeBloodType(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  if (raw.startsWith('AB')) return 'AB'
  if (raw.startsWith('A')) return 'A'
  if (raw.startsWith('B')) return 'B'
  if (raw.startsWith('O')) return 'O'
  return raw
}

function normalizeDonorBloodType(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (DONOR_BLOOD_TYPES.includes(raw)) return raw
  if (raw === 'A') return 'A+'
  if (raw === 'B') return 'B+'
  if (raw === 'AB') return 'AB+'
  if (raw === 'O') return 'O+'
  return 'O+'
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

function discontinuedLabel(value) {
  const code = String(value || '').toUpperCase()
  if (code === 'S') return 'Single'
  if (code === 'D') return 'Double'
  if (code === 'T') return 'Triple'
  return '—'
}

function ConfirmModal({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-99 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[1.35rem] bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700 sm:px-6">{message}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
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
  remarksSd: '',
  donationType: 'first_timer',
  numDonations: '1',
})

const toDigits = (value) => String(value ?? '').replace(/\D/g, '')

function AdminMbd() {
  const p = adminPanel.rose
  const modalScrollRef = useRef(null)
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
  const [deferralForm, setDeferralForm] = useState(emptyDeferralForm)
  const [deferralSaving, setDeferralSaving] = useState(false)
  const [transferAllLoading, setTransferAllLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

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
    setDeferralForm(
      Object.fromEntries(DEFERRAL_FIELDS.map((field) => [field.key, String(Number(row?.deferral_counts?.[field.key]) || 0)])),
    )
    setDonorsLoading(true)
    try {
      const [donorData, deferralData] = await Promise.all([
        apiRequest(`/api/admin/mbd-events/${row.id}/donors`),
        apiRequest(`/api/admin/mbd-events/${row.id}/deferrals`),
      ])
      setDonors(Array.isArray(donorData) ? donorData : [])
      const fetchedCounts = deferralData?.deferral_counts || {}
      setDeferralForm(
        Object.fromEntries(DEFERRAL_FIELDS.map((field) => [field.key, String(Number(fetchedCounts[field.key]) || 0)])),
      )
    } catch (e) {
      showNotification(e.message || 'Failed to load modal data', 'destructive')
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
    setDeferralForm(emptyDeferralForm())
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
    bagType: donorForm.bagType,
    remarksSd: donorForm.remarksSd,
    numDonations: Math.max(
      donorForm.donationType === 'repeater' ? 2 : 1,
      donorForm.numDonations === '' ? (donorForm.donationType === 'repeater' ? 2 : 1) : Number(donorForm.numDonations),
    ),
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
      bloodType: normalizeDonorBloodType(d.blood_type),
      donorNumber: d.donor_number || '',
      age: d.age != null ? String(d.age) : '',
      gender: d.gender || '',
      bagType: normalizeBagGroup(d.bag_type),
      remarksSd: d.remarks_sd || '',
      donationType: Number(d.num_donations) > 1 ? 'repeater' : 'first_timer',
      numDonations: d.num_donations != null ? String(d.num_donations) : '1',
    })
    requestAnimationFrame(() => {
      const el = modalScrollRef.current
      if (el && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (el) {
        el.scrollTop = 0
      }
    })
  }

  const cancelEditDonor = () => {
    setEditingDonorId(null)
    setDonorForm(emptyDonorForm())
  }

  const handleSaveDeferrals = async (e) => {
    e.preventDefault()
    if (!selectedEvent) return
    setDeferralSaving(true)
    try {
      const payload = Object.fromEntries(
        DEFERRAL_FIELDS.map((field) => [field.key, Number(toDigits(deferralForm[field.key] || '0') || 0)]),
      )
      await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/deferrals`, {
        method: 'PUT',
        body: JSON.stringify({ deferralCounts: payload }),
      })
      setDeferralForm(
        Object.fromEntries(DEFERRAL_FIELDS.map((field) => [field.key, String(Number(payload[field.key]) || 0)])),
      )
      setEvents((prev) =>
        prev.map((event) => (event.id === selectedEvent.id ? { ...event, deferral_counts: payload } : event)),
      )
      showNotification('Deferral counts saved.', 'primary')
    } catch (err) {
      showNotification(err.message || 'Could not save deferral counts', 'destructive')
    } finally {
      setDeferralSaving(false)
    }
  }

  const deleteDonor = (d) => {
    setDeleteTarget(d || null)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteDonor = async () => {
    if (!selectedEvent || !deleteTarget) {
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      return
    }
    try {
      await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors/${deleteTarget.id}`, { method: 'DELETE' })
      showNotification('Donor removed.', 'primary')
      const data = await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors`)
      setDonors(Array.isArray(data) ? data : [])
      await loadEvents()
      if (editingDonorId === deleteTarget.id) cancelEditDonor()
    } catch (err) {
      showNotification(err.message || 'Could not delete donor', 'destructive')
    } finally {
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    }
  }

  const transferDonorToDonorList = async (donorId) => {
    if (!selectedEvent || !donorId) return
    await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors/${donorId}/transfer-to-donor-list`, {
      method: 'POST',
    })
  }

  const handleTransferAllToDonorList = async () => {
    if (!selectedEvent) return
    const listedDonors = [...donors]
    if (!listedDonors.length) return
    try {
      setTransferAllLoading(true)
      let successCount = 0
      for (const donor of listedDonors) {
        try {
          await transferDonorToDonorList(donor.id)
          successCount += 1
        } catch {
          // Continue transfer for remaining donors.
        }
      }
      const data = await apiRequest(`/api/admin/mbd-events/${selectedEvent.id}/donors`)
      setDonors(Array.isArray(data) ? data : [])
      if (successCount === listedDonors.length) {
        showNotification(`Processed ${successCount} donor(s) to donor list.`, 'primary')
      } else if (successCount > 0) {
        showNotification(
          `Processed ${successCount} donor(s). ${listedDonors.length - successCount} failed to transfer.`,
          'destructive',
        )
      } else {
        showNotification('No donors were transferred. Please try again.', 'destructive')
      }
    } catch (err) {
      showNotification(err.message || 'Could not add listed donors to donor list', 'destructive')
    } finally {
      setTransferAllLoading(false)
    }
  }

  const inputCls =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200'

  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-600'
  const summary = useMemo(() => {
    const bloodTypeCounts = Object.fromEntries(SUMMARY_BLOOD_TYPES.map((type) => [type, 0]))
    const ageGroupCounts = Object.fromEntries(AGE_GROUPS.map((group) => [group.label, 0]))
    const sexCounts = { Male: 0, Female: 0, Other: 0, Unspecified: 0 }
    const discontinuedCounts = { S: 0, D: 0, T: 0 }
    const discontinuedByType = Object.fromEntries(SUMMARY_BLOOD_TYPES.map((type) => [type, { S: 0, D: 0, T: 0 }]))
    const donationCounts = { firstTimer: 0, repeater: 0 }
    const bagByType = {}
    BAG_GROUPS.forEach((bag) => {
      bagByType[bag] = Object.fromEntries(SUMMARY_BLOOD_TYPES.map((type) => [type, 0]))
    })

    donors.forEach((donor) => {
      const btNorm = normalizeBloodType(donor.blood_type)
      const bt = SUMMARY_BLOOD_TYPES.includes(btNorm) ? btNorm : null
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
      if (rk === 'S') discontinuedCounts.S += 1
      if (rk === 'D') discontinuedCounts.D += 1
      if (rk === 'T') discontinuedCounts.T += 1
      if (bt && (rk === 'S' || rk === 'D' || rk === 'T')) discontinuedByType[bt][rk] += 1

      const donationNumber = Number(donor.num_donations)
      if (Number.isFinite(donationNumber) && donationNumber > 1) donationCounts.repeater += 1
      else donationCounts.firstTimer += 1

      const bag = normalizeBagGroup(donor.bag_type)
      if (bt && BAG_GROUPS.includes(bag)) bagByType[bag][bt] += 1
    })

    const bagTotals = {}
    BAG_GROUPS.forEach((bag) => {
      bagTotals[bag] = SUMMARY_BLOOD_TYPES.reduce((acc, bt) => acc + bagByType[bag][bt], 0)
    })

    return {
      total: donors.length,
      bloodTypeCounts,
      ageGroupCounts,
      sexCounts,
      discontinuedCounts,
      discontinuedByType,
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
      bt: normalizeBloodType(d.blood_type || ''),
      donorNumber: d.donor_number || '',
      age: d.age != null ? d.age : '',
      sex: d.gender || '',
      bag: d.bag_type || '',
      discontinued: discontinuedLabel(d.remarks_sd || ''),
      donation: Number.isFinite(Number(d.num_donations)) ? `${Number(d.num_donations)}X` : '',
    }))

    const summaryBloodRows = SUMMARY_BLOOD_TYPES.map(
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
          <td>${escapeHtml(row.discontinued)}</td>
          <td>${escapeHtml(row.donation)}</td>
        </tr>
      `,
      )
      .join('')

    const bagRows = SUMMARY_BLOOD_TYPES.map((bt) => {
      const discontinuedText = `${summary.discontinuedByType[bt].S} (Single), ${summary.discontinuedByType[bt].D} (Double), ${summary.discontinuedByType[bt].T} (Triple)`
      const cells = BAG_GROUPS.map((bag) => `<td class="num">${summary.bagByType[bag][bt]}</td>`).join('')
      return `<tr><td>${bt}</td><td>${discontinuedText}</td>${cells}</tr>`
    }).join('')
    const deferralRows = DEFERRAL_FIELDS.map((field) => {
      const count = Number(deferralForm[field.key] || 0)
      return `<tr><td>${escapeHtml(field.label)}</td><td class="num">${count}</td></tr>`
    }).join('')
    const deferralTotal = DEFERRAL_FIELDS.reduce((sum, field) => sum + Number(deferralForm[field.key] || 0), 0)

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
            .page-break-before { break-before: page; page-break-before: always; }
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

          <div class="grid">
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
          </div>

          <div class="section-title">Bag Type Breakdown</div>
          <table class="tight">
            <thead>
              <tr>
                <th>BLOOD TYPE</th>
                <th>DISCONTINUED</th>
                ${BAG_GROUPS.map((bag) => `<th class="num">${bag}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${bagRows}
              <tr>
                <td><strong>GRAND TOTAL</strong></td>
                <td><strong>${summary.discontinuedCounts.S} (Single), ${summary.discontinuedCounts.D} (Double), ${summary.discontinuedCounts.T} (Triple)</strong></td>
                ${BAG_GROUPS.map((bag) => `<td class="num"><strong>${summary.bagTotals[bag]}</strong></td>`).join('')}
              </tr>
            </tbody>
          </table>

          <div class="section-title page-break-before">Deferral Breakdown</div>
          <table class="tight" style="max-width: 520px">
            <thead>
              <tr>
                <th>REASON</th>
                <th class="num">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${deferralRows}
              <tr>
                <td><strong>TOTAL</strong></td>
                <td class="num"><strong>${deferralTotal}</strong></td>
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
                <th>Successful</th>
                <th>DISCONTINUED</th>
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

            <div ref={modalScrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
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
                      {DONOR_BLOOD_TYPES.map((bt) => (
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
                      Successful
                    </label>
                    <select
                      id="donor-bag"
                      className={inputCls}
                      value={donorForm.bagType}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, bagType: ev.target.value }))}
                    >
                      {BAG_TYPE_OPTIONS.map((bag) => (
                        <option key={bag.value || 'unset'} value={bag.value}>
                          {bag.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="donor-remarks">
                      Discontinued
                    </label>
                    <select
                      id="donor-remarks"
                      className={inputCls}
                      value={donorForm.remarksSd}
                      onChange={(ev) => setDonorForm((f) => ({ ...f, remarksSd: ev.target.value }))}
                    >
                      {DISCONTINUED_OPTIONS.map((r) => (
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
                      min={1}
                      className={inputCls}
                      value={donorForm.numDonations}
                      onChange={(ev) =>
                        setDonorForm((f) => ({
                          ...f,
                          numDonations: toDigits(ev.target.value),
                        }))
                      }
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

              <form
                onSubmit={handleSaveDeferrals}
                className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Deferral</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Enter deferred counts by reason. Numbers only.
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Total Deferrals:{' '}
                    {DEFERRAL_FIELDS.reduce((sum, field) => sum + Number(deferralForm[field.key] || 0), 0)}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {DEFERRAL_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className={labelCls} htmlFor={`deferral-${field.key}`}>
                        {field.label}
                      </label>
                      <input
                        id={`deferral-${field.key}`}
                        type="number"
                        min={0}
                        className={inputCls}
                        value={deferralForm[field.key] || '0'}
                        onChange={(ev) =>
                          setDeferralForm((prev) => ({
                            ...prev,
                            [field.key]: toDigits(ev.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={deferralSaving}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-60"
                  >
                    {deferralSaving ? 'Saving…' : 'Save deferrals'}
                  </button>
                </div>
              </form>

              <div className="mt-8 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Donors for this event</h3>
                <button
                  type="button"
                  disabled={transferAllLoading || donors.length === 0}
                  onClick={handleTransferAllToDonorList}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {transferAllLoading ? 'Adding all...' : 'Add all to donor list'}
                </button>
              </div>
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
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Disc.</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600"># Don.</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Actions</th>
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
                          <td className="px-3 py-2 text-slate-700">{discontinuedLabel(d.remarks_sd)}</td>
                          <td className="px-3 py-2 text-slate-700">{d.num_donations}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {d.transferred_donor_user_id ? (
                              <span className="mr-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                Added
                              </span>
                            ) : null}
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
      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete donor record?"
        message={deleteTarget ? `Remove donor record for "${deleteTarget.donor_name}"?` : 'Remove this donor record?'}
        confirmText="Delete"
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDeleteTarget(null)
        }}
        onConfirm={confirmDeleteDonor}
      />
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
