/**
 * Shared admin surface styles — clinical / healthcare: calm neutrals, red accent,
 * high contrast text, subtle section cues (left border) instead of heavy rainbow gradients.
 */

const shell =
  'overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-100/80 max-w-full min-w-0'

/** Horizontal scroll for data tables — touch-friendly on iOS */
const tableScrollBase =
  'overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] rounded-b-3xl'

export const adminPanel = {
  /** Requests — warm amber cue (urgency without alarm) */
  amber: {
    outer: `${shell}`,
    header:
      'flex flex-col gap-3 border-b border-slate-100/90 bg-white px-5 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-700',
    tableScroll: `${tableScrollBase} bg-white`,
    thead: 'bg-slate-100/85',
    th: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600',
    tbody: 'divide-y divide-slate-100/90 bg-white',
  },
  /** Inventory — supply / blood (soft rose cue) */
  rose: {
    outer: `${shell}`,
    header:
      'flex flex-col gap-3 border-b border-slate-100/90 bg-white px-5 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-700',
    tableScroll: `${tableScrollBase} bg-white`,
    thead: 'bg-slate-100/85',
    th: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600',
    tbody: 'divide-y divide-slate-100/90 bg-white',
  },
  /** Donations — life / wellness */
  emerald: {
    outer: `${shell}`,
    header:
      'flex flex-col gap-3 border-b border-slate-100/90 bg-white px-5 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-700',
    tableScroll: `mt-0 ${tableScrollBase} bg-white`,
    thead: 'bg-slate-100/85',
    th: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600',
    tbody: 'divide-y divide-slate-100/90 bg-white',
  },
  /** Partners — facilities */
  sky: {
    outer: `${shell}`,
    header:
      'flex flex-col gap-3 border-b border-slate-100/90 bg-white px-5 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-700',
    tableScroll: `mt-0 ${tableScrollBase} bg-white`,
    thead: 'bg-slate-100/85',
    th: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600',
    tbody: 'divide-y divide-slate-100/90 bg-white',
  },
  /** Users — access control */
  violet: {
    outer: `${shell}`,
    header:
      'border-b border-slate-100/90 bg-white px-5 py-4 sm:px-6',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-700',
    tableScroll: `${tableScrollBase} bg-white`,
    thead: 'bg-slate-100/85',
    th: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600',
    tbody: 'divide-y divide-slate-100/90 bg-white',
  },
}

const reportShell =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/20 ring-1 ring-slate-100/80 sm:p-5 max-w-full min-w-0'

/** Use for tables outside adminPanel (e.g. reports) */
export const responsiveTableContainer = tableScrollBase

/** Reports — section cards with subtle left accent */
export const adminReportSection = {
  sky: `${reportShell}`,
  rose: `${reportShell}`,
  emerald: `${reportShell}`,
  amber: `${reportShell}`,
  violet: `${reportShell}`,
  slate: `${reportShell}`,
  orange: `${reportShell}`,
  indigo: `${reportShell}`,
}

export const adminReportLoading =
  'mt-6 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-white to-red-50/20 p-6 text-center shadow-sm ring-1 ring-slate-100 sm:p-10'

/** Primary actions — min 44px tap height on small screens */
export const adminBtnPrimary =
  'inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-900/10 transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:min-h-0 sm:min-w-0 sm:py-2'

export const adminBtnSecondary =
  'inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:min-h-0 sm:min-w-0 sm:py-2'

export const adminInput =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm transition focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25 sm:min-h-0 sm:py-2 sm:text-sm'
