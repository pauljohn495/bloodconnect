/**
 * Consistent blood-type colors across the app: badges, tables, and charts.
 * A+ soft red · A− rose · B+ orange · B− amber · AB+ purple · AB− violet · O+ strong red · O− dark red (universal donor)
 */

/** Tailwind-friendly classes: bg, text, ring */
export const bloodTypeBadgeClasses = {
  'A+': 'bg-red-200/90 text-red-900 ring-red-300/80',
  'A-': 'bg-rose-200/90 text-rose-900 ring-rose-300/80',
  'B+': 'bg-orange-200/90 text-orange-900 ring-orange-300/80',
  'B-': 'bg-amber-200/90 text-amber-950 ring-amber-300/80',
  'AB+': 'bg-purple-200/90 text-purple-900 ring-purple-300/80',
  'AB-': 'bg-violet-200/90 text-violet-900 ring-violet-300/80',
  'O+': 'bg-red-300/95 text-red-950 ring-red-400/90',
  /** Universal donor — high emphasis */
  'O-': 'bg-red-800 text-red-50 ring-red-900/80',
}

/** Primary fill for Recharts / inline SVG */
export const bloodTypeChartColor = {
  'A+': '#f87171',
  'A-': '#fb7185',
  'B+': '#fb923c',
  'B-': '#fbbf24',
  'AB+': '#c084fc',
  'AB-': '#a78bfa',
  'O+': '#ef4444',
  'O-': '#991b1b',
}

const NEUTRAL_BADGE = 'bg-slate-100 text-slate-700 ring-slate-200/90'

export function normalizeBloodType(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw)
    .trim()
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase()
  if (!s) return null
  if (s === 'AB+' || s === 'AB-') return s
  if (s === 'A+' || s === 'A-') return s
  if (s === 'B+' || s === 'B-') return s
  if (s === 'O+' || s === 'O-') return s
  return null
}

export function getBloodTypeBadgeClasses(type) {
  const key = normalizeBloodType(type)
  if (!key) return NEUTRAL_BADGE
  return bloodTypeBadgeClasses[key] || NEUTRAL_BADGE
}

export function getBloodTypeChartColor(type) {
  const key = normalizeBloodType(type)
  if (!key) return '#94a3b8'
  return bloodTypeChartColor[key] || '#94a3b8'
}
