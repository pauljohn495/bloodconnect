/**
 * Shared admin surface styles — clinical / healthcare: calm neutrals, red accent,
 * high contrast text, subtle section cues (left border) instead of heavy rainbow gradients.
 */

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/25 ring-1 ring-slate-100/90 max-w-full min-w-0'

/** Horizontal scroll for data tables — touch-friendly on iOS */
const tableScrollBase =
  'overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]'

export const adminPanel = {
  /** Requests — warm amber cue (urgency without alarm) */
  amber: {
    outer: `${shell} border-l-[4px] border-l-amber-400`,
    header:
      'flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-amber-50/50 via-white to-white px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-500',
    tableScroll: `${tableScrollBase} bg-slate-50/40`,
    thead: 'bg-slate-50/95',
    th: 'text-xs font-semibold uppercase tracking-wider text-slate-600',
    tbody: 'divide-y divide-slate-100 bg-white',
  },
  /** Inventory — supply / blood (soft rose cue) */
  rose: {
    outer: `${shell} border-l-[4px] border-l-rose-400`,
    header:
      'flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-rose-50/45 via-white to-white px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-500',
    tableScroll: `${tableScrollBase} bg-slate-50/40`,
    thead: 'bg-slate-50/95',
    th: 'text-xs font-semibold uppercase tracking-wider text-slate-600',
    tbody: 'divide-y divide-slate-100 bg-white',
  },
  /** Donations — life / wellness */
  emerald: {
    outer: `${shell} border-l-[4px] border-l-emerald-500`,
    header:
      'flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/45 via-white to-white px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-500',
    tableScroll: `mt-0 ${tableScrollBase} bg-slate-50/40`,
    thead: 'bg-slate-50/95',
    th: 'text-xs font-semibold uppercase tracking-wider text-slate-600',
    tbody: 'divide-y divide-slate-100 bg-white',
  },
  /** Partners — facilities */
  sky: {
    outer: `${shell} border-l-[4px] border-l-sky-500`,
    header:
      'flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-sky-50/40 via-white to-white px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-500',
    tableScroll: `mt-0 ${tableScrollBase} bg-slate-50/40`,
    thead: 'bg-slate-50/95',
    th: 'text-xs font-semibold uppercase tracking-wider text-slate-600',
    tbody: 'divide-y divide-slate-100 bg-white',
  },
  /** Users — access control */
  violet: {
    outer: `${shell} border-l-[4px] border-l-violet-500`,
    header:
      'border-b border-slate-100 bg-gradient-to-r from-violet-50/35 via-white to-white px-4 py-4 sm:px-5',
    title: 'text-base font-semibold tracking-tight text-slate-900',
    subtitle: 'mt-0.5 text-sm text-slate-500',
    tableScroll: `${tableScrollBase} bg-slate-50/40`,
    thead: 'bg-slate-50/95',
    th: 'text-xs font-semibold uppercase tracking-wider text-slate-600',
    tbody: 'divide-y divide-slate-100 bg-white',
  },
}

const reportShell =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/20 ring-1 ring-slate-100/80 sm:p-5 max-w-full min-w-0'

/** Use for tables outside adminPanel (e.g. reports) */
export const responsiveTableContainer = tableScrollBase

/** Reports — section cards with subtle left accent */
export const adminReportSection = {
  sky: `${reportShell} border-l-[4px] border-l-sky-500`,
  rose: `${reportShell} border-l-[4px] border-l-rose-400`,
  emerald: `${reportShell} border-l-[4px] border-l-emerald-500`,
  amber: `${reportShell} border-l-[4px] border-l-amber-400`,
  violet: `${reportShell} border-l-[4px] border-l-violet-500`,
  slate: `${reportShell} border-l-[4px] border-l-slate-400`,
  orange: `${reportShell} border-l-[4px] border-l-orange-400`,
  indigo: `${reportShell} border-l-[4px] border-l-indigo-500`,
}

export const adminReportLoading =
  'mt-6 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-white to-red-50/20 p-6 text-center shadow-sm ring-1 ring-slate-100 sm:p-10'

/** Primary actions — min 44px tap height on small screens */
export const adminBtnPrimary =
  'inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:min-h-0 sm:min-w-0 sm:py-2'

export const adminBtnSecondary =
  'inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:min-h-0 sm:min-w-0 sm:py-2'

export const adminInput =
  'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm transition focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25 sm:min-h-0 sm:py-2 sm:text-sm'
