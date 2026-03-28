import logoUrl from './assets/bloodconnect_logo.png'

/**
 * App mark for headers and sidebars. Decorative when paired with visible "BloodConnect" text.
 * @param {'light' | 'hero'} tone — hero: sits on the red marketing header; light: white sidebars / dashboard.
 */
export function BrandLogo({ tone = 'light', className = 'h-9 w-9', roundedClass = 'rounded-xl' }) {
  const shell =
    tone === 'hero'
      ? 'bg-white/95 shadow-sm ring-1 ring-white/25'
      : 'bg-white shadow-sm ring-1 ring-slate-200/80'

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${shell} ${roundedClass} ${className}`}
    >
      <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" draggable={false} />
    </span>
  )
}
