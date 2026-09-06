import { useCallback, useMemo, useState } from 'react'
import { FeedState, Icon, Modal } from './shared.jsx'
import { formatDate, parseDate, usePublicFeed } from './data.js'

const typeLabel = type => ({ blood_drive: 'Blood drive', urgent_need: 'Urgent need', general: 'General' })[type] || 'General'
const statusLabel = status => ({ upcoming: 'Upcoming', ongoing: 'Ongoing', completed: 'Completed' })[status] || 'Upcoming'

export function ScheduleDetail({ item, onClose }) {
  const date = formatDate(item.event_starts_at)
  return <Modal title={item.title} eyebrow={typeLabel(item.announcement_type)} onClose={onClose}>
    <div className="bc-detail-badges"><span className={`bc-status ${item.status === 'ongoing' ? 'bc-status-live' : ''}`}>{statusLabel(item.status)}</span></div>
    <div className="bc-detail-facts"><div><Icon name="calendar" /><div><small>WHEN</small><strong>{date.full}</strong><span>{date.time}</span></div></div><div><Icon name="location" /><div><small>WHERE</small><strong>{item.location || 'Location to be announced'}</strong>{item.location && <a className="bc-text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`} target="_blank" rel="noopener noreferrer">Open in Google Maps<Icon name="arrow" /></a>}</div></div></div>
    <p className="bc-detail-body">{item.description || 'No description provided.'}</p>
    <p className="bc-meta">Date added: {formatDate(item.created_at).short} · {formatDate(item.created_at).time}</p>
    <button className="bc-button bc-button-secondary bc-full-width" onClick={onClose}>Close</button>
  </Modal>
}

export function EventCard({ item, onSelect, compact = false }) {
  const date = formatDate(item.event_starts_at)
  return <button className={`bc-event-card ${compact ? 'bc-event-compact' : ''}`} onClick={() => onSelect(item)}>
    <span className="bc-event-date"><span>{date.month}</span><strong>{date.day}</strong><small>{date.weekday}</small></span>
    <span className="bc-event-content"><span className="bc-event-tags"><span className="bc-meta">{typeLabel(item.announcement_type)}</span><span className={`bc-status ${item.status === 'ongoing' ? 'bc-status-live' : ''}`}>{statusLabel(item.status)}</span></span><span className="bc-event-title">{item.title}</span><span className="bc-event-location"><Icon name="location" />{item.location || 'Location to be announced'}</span><span className="bc-event-time"><Icon name="clock" />{date.time}</span></span>
    <span className="bc-event-arrow"><Icon name="arrow" /></span>
  </button>
}

export function Calendar({ items, onSelect }) {
  const earliest = useMemo(() => {
    const dates = items.map(item => parseDate(item.event_starts_at)).filter(Boolean)
    return dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : new Date()
  }, [items])
  const [offset, setOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)
  const month = new Date(earliest.getFullYear(), earliest.getMonth() + offset, 1)
  const events = items.filter(item => { const date = parseDate(item.event_starts_at); return date && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear() })
  const undated = items.filter(item => !parseDate(item.event_starts_at))
  const agenda = selectedDay == null ? events : events.filter(item => parseDate(item.event_starts_at).getDate() === selectedDay)
  const cells = Array.from({ length: Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const day = index - month.getDay() + 1
    return day > 0 && day <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() ? day : null
  })
  const today = new Date()
  const changeMonth = step => { setOffset(value => value + step); setSelectedDay(null) }
  return <div className="bc-calendar-layout"><div className="bc-calendar"><div className="bc-calendar-heading"><h3 aria-live="polite">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><div><button className="bc-icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="left" /></button><button className="bc-icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><Icon name="right" /></button></div></div><p className="bc-calendar-help">Select a highlighted date to see its drives.</p><div className="bc-calendar-grid">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="bc-calendar-weekday">{day}</span>)}{cells.map((day, index) => {
    if (!day) return <span key={`blank-${index}`} />
    const dayEvents = events.filter(item => parseDate(item.event_starts_at).getDate() === day)
    const isToday = today.getDate() === day && today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear()
    return <button key={day} disabled={!dayEvents.length} className={`bc-calendar-day ${dayEvents.length ? 'bc-calendar-has-events' : ''} ${selectedDay === day ? 'bc-calendar-selected' : ''} ${isToday ? 'bc-calendar-today' : ''}`} aria-current={isToday ? 'date' : undefined} aria-pressed={selectedDay === day} aria-label={`${month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} ${day}, ${dayEvents.length} donation events`} onClick={() => setSelectedDay(value => value === day ? null : day)}>{day}{dayEvents.length > 0 && <span className="bc-calendar-dot" />}</button>
  })}</div><div className="bc-calendar-legend"><span className="bc-calendar-dot" />Donation event<span className="bc-today-legend" />Today</div></div><div className="bc-calendar-agenda"><div className="bc-agenda-heading"><h3>{selectedDay ? `Events on ${formatDate(new Date(month.getFullYear(), month.getMonth(), selectedDay)).short}` : 'This month’s events'}</h3>{selectedDay && <button className="bc-text-link" onClick={() => setSelectedDay(null)}>Show month</button>}</div><div aria-live="polite">{agenda.length ? agenda.map(item => <EventCard key={item.id} item={item} onSelect={onSelect} compact />) : <p className="bc-calendar-empty">No donation events this month. Browse another month or switch to List to see all events.</p>}</div>{undated.length > 0 && <><h3 className="bc-undated-heading">Dates to be announced</h3>{undated.map(item => <EventCard key={item.id} item={item} onSelect={onSelect} compact />)}</>}</div></div>
}

export default function DonationSchedule({ canRegister, onRegister }) {
  const feed = usePublicFeed('/api/announcements?limit=10&activeOnly=true&sort=nearest')
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const close = useCallback(() => setSelected(null), [])
  return <section id="schedule" className="bc-schedule bc-section"><div className="bc-container">
    <div className="bc-section-heading"><div><p className="bc-eyebrow">MAKE TIME TO MAKE A DIFFERENCE</p><h2>Blood Donation <span>Schedule</span></h2></div><p>Your next opportunity to give starts here.<br />Explore upcoming and active donation drives.</p></div>
    <div className="bc-schedule-toolbar"><div className="bc-schedule-label"><Icon name="calendar" /><span>Find your next blood drive</span>{feed.status === 'success' && <span className="bc-count">{feed.items.length}</span>}</div><div className="bc-toggle" aria-label="Donation schedule view">{['list', 'calendar'].map(mode => <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)}><Icon name={mode} />{mode === 'list' ? 'List' : 'Calendar'}</button>)}</div></div>
    <FeedState feed={feed} icon="calendar" emptyTitle="A new chance to give is on its way" emptyText="No active donation events are scheduled yet. Check back soon for upcoming drives in your community." />
    {feed.status === 'success' && feed.items.length > 0 && (view === 'list' ? <div className="bc-event-list">{feed.items.map(item => <EventCard key={item.id} item={item} onSelect={setSelected} />)}</div> : <Calendar items={feed.items} onSelect={setSelected} />)}
    <div className="bc-schedule-note"><span><Icon name="heart" /><span>New to giving? Your first donation starts with a simple step.</span></span>{canRegister && <button className="bc-text-link" onClick={onRegister}>Join as a donor<Icon name="arrow" /></button>}</div>
  </div>{selected && <ScheduleDetail item={selected} onClose={close} />}</section>
}
