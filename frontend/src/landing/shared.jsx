import { useEffect, useId, useRef } from 'react'

export function Icon({ name, className = '' }) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    down: <path d="M12 5v14m-5-5 5 5 5-5" />,
    up: <path d="M12 19V5m-5 5 5-5 5 5" />,
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
    calendar: <><path d="M7 3v4m10-4v4M3 10h18" /><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 14h3m4 0h3m-10 4h3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M3 6h1M3 12h1M3 18h1" /></>,
    news: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h3M8 18h8" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    drop: <path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z" />,
    hospital: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M10 7h4m-2-2v4M9 13h1m4 0h1M10 21v-4h4v4" /></>,
    users: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6m3 4a5 5 0 0 1 3 4v3" /></>,
    truck: <><path d="M3 5h11v12H3zM14 10h4l3 4v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    network: <><rect x="8" y="2" width="8" height="6" rx="1" /><path d="M12 8v5M4 16v-3h16v3" /><rect x="1" y="16" width="6" height="5" rx="1" /><rect x="9" y="16" width="6" height="5" rx="1" /><rect x="17" y="16" width="6" height="5" rx="1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg className={`bc-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function FeedState({ feed, icon, emptyTitle, emptyText }) {
  if (feed.status === 'success' && feed.items.length) return null
  if (feed.status === 'loading') return <div className="bc-feed-loading" role="status"><span className="bc-sr-only">Loading updates…</span>{[0, 1, 2].map(item => <div key={item} className="bc-skeleton"><span /><span /><span /></div>)}</div>
  const error = feed.status === 'error'
  return <div className="bc-empty" role="status"><span className="bc-icon-tile"><Icon name={icon} /></span><h3>{error ? 'We couldn’t load these updates' : emptyTitle}</h3><p>{error ? 'Please try again to see the latest information.' : emptyText}</p>{error && <button className="bc-button bc-button-secondary" onClick={feed.retry}>Try again<Icon name="arrow" /></button>}</div>
}

export function Modal({ title, eyebrow, onClose, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const handleKey = event => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])
  return <div className="bc-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} className="bc-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><button className="bc-modal-close bc-icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button><p className="bc-eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2>{children}</section></div>
}
