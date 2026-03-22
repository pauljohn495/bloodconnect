import { getBloodTypeBadgeClasses } from './bloodTypeColors.js'

const baseBadge =
  'inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1'

/** Read-only blood type pill. Renders em dash for empty/unknown. */
export function BloodTypeBadge({ type, className = '', children, title, ...rest }) {
  const label = children != null ? children : type
  const show = label != null && label !== '' && label !== '—'
  if (!show) {
    return (
      <span className={`text-slate-400 ${className}`} {...rest}>
        —
      </span>
    )
  }
  const cls = getBloodTypeBadgeClasses(type ?? label)
  return (
    <span className={`${baseBadge} ${cls} ${className}`} title={title} {...rest}>
      {label}
    </span>
  )
}
