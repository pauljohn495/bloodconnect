// Server-rendered regression checks. These do not substitute for browser QA.
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let checks = 0
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`) }
const noop = () => {}

try {
  const { default: Home, PostDetail } = await server.ssrLoadModule('/src/home.jsx')
  const { FeatureFlagsProvider } = await server.ssrLoadModule('/src/featureFlagsContext.jsx')
  const { Calendar, EventCard, ScheduleDetail } = await server.ssrLoadModule('/src/landing/DonationSchedule.jsx')
  const { FeedState } = await server.ssrLoadModule('/src/landing/shared.jsx')
  const { formatDate, parseDate } = await server.ssrLoadModule('/src/landing/data.js')
  const { default: LoginModal } = await server.ssrLoadModule('/src/landing/LoginModal.jsx')
  const page = renderToStaticMarkup(h(MemoryRouter, null, h(FeatureFlagsProvider, null, h(Home))))

  check('Protected content and all four navigation actions remain rendered', () => {
    const text = page.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    for (const label of ['Login', 'Donate', 'About', 'Rankings', 'Blood Donation Schedule', 'Recent Announcements &amp; Posts', 'Volunteers • Logistics • Information Technology', 'Always First, Always Ready, Always There']) assert.ok(text.includes(label), label)
    for (const id of ['schedule', 'about', 'announcements', 'community', 'donate']) assert.ok(page.includes(`id="${id}"`), id)
    assert.ok(page.includes('Skip to content'))
  })

  const events = [
    { id: 1, title: 'Late December drive', event_starts_at: '2027-12-31T09:00:00', location: 'Town Hall & Community Center', status: 'ongoing', announcement_type: 'blood_drive', description: 'Bring your community together.', created_at: '2027-12-01T10:00:00' },
    { id: 2, title: 'Second drive on the same day', event_starts_at: '2027-12-31T14:00:00', status: 'upcoming' },
    { id: 3, title: 'New year drive', event_starts_at: '2028-01-03T09:00:00', status: 'upcoming' },
    { id: 4, title: 'Pending date drive', event_starts_at: null, status: 'upcoming' },
  ]
  check('Calendar retains same-day events and undated events', () => {
    const calendar = renderToStaticMarkup(h(Calendar, { items: events, onSelect: noop }))
    assert.ok(calendar.includes('December 2027'))
    for (const title of [events[0].title, events[1].title, events[3].title]) assert.ok(calendar.includes(title), title)
    assert.ok(calendar.includes('2 donation events'))
    assert.ok(calendar.includes('Previous month'))
    assert.ok(calendar.includes('Next month'))
  })

  check('Calendar handles leap day and a feed containing only invalid dates', () => {
    const leap = renderToStaticMarkup(h(Calendar, { items: [{ id: 5, title: 'Leap day drive', event_starts_at: '2028-02-29T09:00:00' }], onSelect: noop }))
    assert.ok(leap.includes('February 2028'))
    assert.ok(leap.includes('29, 1 donation events'))
    const unknown = renderToStaticMarkup(h(Calendar, { items: [{ id: 6, title: 'Date pending', event_starts_at: 'invalid' }], onSelect: noop }))
    assert.ok(unknown.includes('Dates to be announced'))
    assert.ok(unknown.includes('Date pending'))
    assert.ok(!unknown.includes('Invalid Date'))
  })

  check('Event cards keep title, location, date, type, and status', () => {
    const card = renderToStaticMarkup(h(EventCard, { item: events[0], onSelect: noop }))
    for (const text of ['Late December drive', 'Town Hall &amp; Community Center', 'Ongoing', 'Blood drive', '31']) assert.ok(card.includes(text), text)
  })

  check('Schedule details preserve descriptions and encoded map destinations', () => {
    const detail = renderToStaticMarkup(h(ScheduleDetail, { item: events[0], onClose: noop }))
    assert.ok(detail.includes('Bring your community together.'))
    assert.ok(detail.includes(encodeURIComponent(events[0].location)))
    assert.ok(detail.includes('Date added:'))
    assert.ok(detail.includes('role="dialog"'))
    assert.ok(detail.includes('aria-modal="true"'))
  })

  check('Post details render the full body and every supplied image', () => {
    const detail = renderToStaticMarkup(h(PostDetail, { item: { title: 'Community news', body: 'Full story\nSecond paragraph', image_urls: ['/first.png', '/second.png', '/third.png'], created_at: '2027-12-01T10:00:00' }, onClose: noop }))
    for (const text of ['Full story', 'Second paragraph', '/first.png', '/second.png', '/third.png']) assert.ok(detail.includes(text), text)
    assert.equal((detail.match(/<img /g) || []).length, 3)
  })

  check('Loading, empty, and failed feed states are distinct', () => {
    const render = status => renderToStaticMarkup(h(FeedState, { feed: { status, items: [], retry: noop }, icon: 'calendar', emptyTitle: 'No drives scheduled', emptyText: 'Check back soon.' }))
    assert.ok(render('loading').includes('Loading updates'))
    assert.ok(render('success').includes('No drives scheduled'))
    assert.ok(!render('success').includes('Try again'))
    assert.ok(render('error').includes('Try again'))
    assert.ok(!render('error').includes('No drives scheduled'))
  })

  check('Login exposes all account roles and donor ID mode; registration respects its flag', () => {
    const render = canRegister => renderToStaticMarkup(h(MemoryRouter, null, h(LoginModal, { onClose: noop, canRegister })))
    const login = render(true)
    for (const text of ['donor', 'hospital', 'admin', 'Use donor ID instead', 'current-password', 'Create an account']) assert.ok(login.includes(text), text)
    assert.ok(!render(false).includes('Create an account'))
  })

  check('Missing and invalid dates use explicit fallback labels', () => {
    for (const value of [null, undefined, '', 'invalid']) {
      assert.equal(parseDate(value), null)
      assert.equal(formatDate(value).full, 'Date to be announced')
    }
    assert.equal(formatDate('2028-02-29T09:00:00').day, '29')
  })

  console.log(`\n${checks} landing page regression checks passed.`)
} finally {
  await server.close()
}
