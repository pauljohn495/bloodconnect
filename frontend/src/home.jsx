import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'
import { useFeatureFlags } from './featureFlagsContext.jsx'
import { Icon, Modal, FeedState } from './landing/shared.jsx'
import { formatDate, usePublicFeed } from './landing/data.js'
import LoginModal from './landing/LoginModal.jsx'
import DonationSchedule from './landing/DonationSchedule.jsx'
import donorPhoto from './assets/image1.jpg'
import teamPhoto from './assets/images2.jpg'
import './landing/home.css'

function DonorPhoto() {
  return (
    <figure className="bc-hero-photo">
      <div className="bc-hero-photo-frame">
        <img
          src={donorPhoto}
          alt="A blood donor receiving care from a healthcare worker during a donation"
          width="6000"
          height="4000"
          fetchPriority="high"
          decoding="async"
        />
      </div>
      <figcaption>
        <span className="bc-icon-tile"><Icon name="heart" /></span>
        <span><strong>A moment of kindness.</strong><small>A connection that matters.</small></span>
        <span className="bc-photo-caption-rule" aria-hidden="true" />
      </figcaption>
    </figure>
  )
}
export function PostDetail({ item, onClose }) {
  return <Modal title={item.title} eyebrow={`Community update · ${formatDate(item.created_at).short}`} onClose={onClose}>
    <div className="bc-post-gallery">{(Array.isArray(item.image_urls) ? item.image_urls : []).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${item.title} — image ${index + 1}`} loading="lazy" />)}</div>
    <p className="bc-detail-body">{item.body || 'No content provided.'}</p>
    <button className="bc-button bc-button-secondary bc-full-width" onClick={onClose}>Close</button>
  </Modal>
}

function News({ onSelect }) {
  const feed = usePublicFeed('/api/home-posts?limit=6')
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? feed.items : feed.items.slice(0, 3)
  return <section id="announcements" className="bc-news bc-section">
    <div className="bc-container">
      <div className="bc-section-heading"><div><p className="bc-eyebrow">THE LATEST FROM OUR COMMUNITY</p><h2>Recent Announcements <span>&amp; Posts</span></h2></div><p>Good things happen when we stay connected.<br />Here’s what’s happening in our community.</p></div>
      <FeedState feed={feed} icon="news" emptyTitle="Our next story is on its way" emptyText="Announcements, stories, and community updates will appear here." />
      {feed.status === 'success' && feed.items.length > 0 && <>
        <div className="bc-news-grid">{visible.map((post, index) => <button key={post.id} className={`bc-news-card ${index === 0 ? 'bc-news-featured' : ''}`} onClick={() => onSelect(post)}>
          <div className={`bc-news-image ${post.image_urls?.[0] ? '' : 'bc-news-placeholder'}`}>
            {post.image_urls?.[0] ? <img src={post.image_urls[0]} alt="" loading="lazy" /> : <><Icon name="heart" /><span>Connected by compassion.</span></>}
            <span className="bc-news-category">{index === 0 ? 'Featured update' : 'Community update'}</span>
          </div>
          <div className="bc-news-copy"><p className="bc-meta">{formatDate(post.created_at).short}</p><h3>{post.title}</h3><p className="bc-news-excerpt">{post.body}</p><span className="bc-text-link">Read story <Icon name="arrow" /></span></div>
        </button>)}</div>
        {feed.items.length > 3 && <div className="bc-news-more"><button className="bc-button bc-button-secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer updates' : `View all ${feed.items.length} updates`}<Icon name={expanded ? 'up' : 'arrow'} /></button></div>}
      </>}
    </div>
  </section>
}

export default function Home() {
  const navigate = useNavigate()
  const { isFlagEnabled } = useFeatureFlags()
  const enabled = key => isFlagEnabled('public', `public.${key}`)
  const showSchedule = enabled('section_mbd'), showAbout = enabled('section_about'), showDonate = enabled('section_donate'), canRegister = enabled('register')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [post, setPost] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const menuRef = useRef(null)
  const closeLogin = useCallback(() => setLoginOpen(false), [])
  const closePost = useCallback(() => setPost(null), [])

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 16)
      const active = ['schedule', 'about', 'announcements', 'donate'].filter(id => {
        const element = document.getElementById(id)
        return element && element.getBoundingClientRect().top < 160
      }).at(-1)
      setActiveSection(active || '')
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = event => { if (event.key === 'Escape') { setMobileOpen(false); menuRef.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const scroll = id => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const openLogin = () => { setMobileOpen(false); setLoginOpen(true) }
  const donate = () => showDonate ? scroll('donate') : showSchedule ? scroll('schedule') : canRegister ? navigate('/register') : openLogin()
  const links = [
    enabled('nav_announcements') && { label: 'Login', action: openLogin, id: 'login' },
    enabled('nav_donate') && { label: 'Donate', action: donate, id: 'donate' },
    enabled('nav_about') && { label: 'About', action: () => scroll(showAbout ? 'about' : 'community'), id: 'about' },
    { label: 'Rankings', action: () => { setMobileOpen(false); navigate('/rankings') }, id: 'rankings' },
  ].filter(Boolean)

  return <div className="bc-landing">
    <a href="#main-content" className="bc-skip-link">Skip to content</a>
    <header className={`bc-header ${scrolled ? 'bc-header-scrolled' : ''}`}>
      <div className="bc-container bc-nav-inner">
        <button className="bc-brand" aria-label="BloodConnect home" onClick={() => scroll('main-content')}><BrandLogo className="h-10 w-10" /><span>Blood<span>Connect</span><small>CONNECTING LIVES. INSPIRING HOPE.</small></span></button>
        <nav className="bc-desktop-nav" aria-label="Primary navigation">{links.map(link => <button key={link.id} onClick={link.action} className={`bc-nav-link ${activeSection === link.id ? 'bc-nav-active' : ''}`} aria-current={activeSection === link.id ? 'location' : undefined}>{link.label}</button>)}</nav>
        {canRegister && <button className="bc-button bc-button-primary bc-nav-cta" onClick={() => navigate('/register')}>Become a donor <Icon name="arrow" /></button>}
        <button ref={menuRef} className="bc-menu-button" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation"><Icon name={mobileOpen ? 'close' : 'menu'} /></button>
      </div>
      {mobileOpen && <nav id="mobile-navigation" className="bc-mobile-nav" aria-label="Mobile navigation">{links.map(link => <button key={link.id} onClick={link.action}>{link.label}<Icon name="arrow" /></button>)}{canRegister && <button onClick={() => navigate('/register')}>Become a donor<Icon name="heart" /></button>}</nav>}
    </header>

    <main id="main-content" tabIndex={-1}>
      <section className="bc-hero">
        <div className="bc-container bc-hero-grid">
          <div className="bc-hero-copy">
            <h1>A little of you.<br />A lifeline for<br /><em>someone else.</em></h1>
            <p className="bc-hero-description">Bringing donors, hospitals, and communities together. BloodConnect makes it easier to give blood, find support, and be there when it matters.</p>
            <div className="bc-hero-actions">{canRegister ? <button className="bc-button bc-button-primary" onClick={() => navigate('/register')}>Become a donor<Icon name="arrow" /></button> : <button className="bc-button bc-button-primary" onClick={openLogin}>Sign in to the portal<Icon name="arrow" /></button>}{showSchedule && <button className="bc-button bc-button-secondary" onClick={() => scroll('schedule')}><Icon name="calendar" />Find a blood drive</button>}</div>
            <div className="bc-hero-note"><span className="bc-heart-stack"><Icon name="heart" /><Icon name="users" /><Icon name="drop" /></span><p>Different people. One shared purpose.<br /><strong>A healthier, more connected community.</strong></p></div>
          </div>
          <DonorPhoto />
        </div>
        <div className="bc-container bc-hero-foot"><span>A SMALL ACT. AN EXTRAORDINARY IMPACT.</span><button onClick={() => scroll(showSchedule ? 'schedule' : 'announcements')}>Discover the difference <Icon name="down" /></button></div>
      </section>

      <div className="bc-purpose-strip"><div className="bc-container"><span><Icon name="heart" /> Powered by compassion</span><span><Icon name="hospital" /> Connected through care</span><span><Icon name="users" /> Stronger as a community</span></div></div>

      {showSchedule && <DonationSchedule canRegister={canRegister} onRegister={() => navigate('/register')} />}

      {showAbout && <section id="about" className="bc-overview bc-section"><div className="bc-container bc-overview-grid">
        <div><p className="bc-eyebrow">CARE THAT COMES FULL CIRCLE</p><h2>One platform.<br />A community<br /><em>of possibilities.</em></h2><p className="bc-overview-intro">Behind every donation is a network of people who care. We help them work together.</p><button className="bc-text-link" onClick={openLogin}>Explore your portal <Icon name="arrow" /></button></div>
        <div className="bc-platform-features">{[
          { number: '01', icon: 'heart', title: 'For the people who give', text: 'Find donation drives, keep track of your donation history, and stay connected to local blood needs.' },
          { number: '02', icon: 'hospital', title: 'For the teams who care', text: 'Coordinate blood requests and manage hospital inventory, with the information your team needs in one place.' },
          { number: '03', icon: 'users', title: 'For a community that shows up', text: 'Bring volunteers, logistics, and local updates together to turn shared compassion into coordinated action.' },
        ].map(feature => <article key={feature.number} className="bc-platform-feature"><span className="bc-icon-tile"><Icon name={feature.icon} /></span><div><h3>{feature.title}</h3><p>{feature.text}</p></div><span className="bc-feature-number">{feature.number}</span></article>)}</div>
      </div></section>}

      <News onSelect={setPost} />

      <section id="community" className="bc-community"><div className="bc-container bc-community-grid"><div><p className="bc-eyebrow">THE PEOPLE BEHIND THE PURPOSE</p><p className="bc-community-disciplines">Volunteers • Logistics • Information Technology</p><h2>Always First,<br />Always Ready,<br /><em>Always There</em></h2><p>Compassion is where it starts. Connection is how it grows. Together, we’re building a community that’s ready to make a difference.</p></div><figure className="bc-community-photo">
          <div className="bc-community-photo-frame">
            <img src={teamPhoto} alt="A healthcare worker preparing donation records and supplies at a community blood drive" width="5952" height="3720" loading="lazy" decoding="async" />
          </div>
          <figcaption><Icon name="users" /><span>Care in action. Community at heart.</span></figcaption>
        </figure></div></section>

      {showDonate && <section id="donate" className="bc-final-cta bc-section"><div className="bc-container"><span className="bc-icon-tile"><Icon name="drop" /></span><p className="bc-eyebrow">YOUR NEXT SMALL ACT STARTS HERE</p><h2>Be someone’s<br /><em>reason to hope.</em></h2><p>Join a community that gives more than blood.<br />It gives people a chance at tomorrow.</p><div className="bc-hero-actions">{canRegister && <button className="bc-button bc-button-primary" onClick={() => navigate('/register')}>Register as a donor<Icon name="arrow" /></button>}<button className="bc-button bc-button-secondary" onClick={openLogin}>Sign in to BloodConnect</button></div></div></section>}
    </main>

    <footer className="bc-footer"><div className="bc-container"><div className="bc-footer-top"><div><button className="bc-brand" onClick={() => scroll('main-content')}><BrandLogo className="h-9 w-9" /><span>Blood<span>Connect</span></span></button><p>Connecting people. Coordinating care.<br />Making every drop count.</p></div><div className="bc-footer-links"><p>GET CONNECTED</p>{links.map(link => <button key={link.id} onClick={link.action}>{link.label}</button>)}</div><div className="bc-footer-links"><p>STAY INVOLVED</p>{showSchedule && <button onClick={() => scroll('schedule')}>Blood donation schedule</button>}<button onClick={() => scroll('announcements')}>Announcements &amp; posts</button><button onClick={() => scroll('community')}>Our community</button></div></div><div className="bc-footer-bottom"><span>© {new Date().getFullYear()} BloodConnect. All rights reserved.</span><span>Built around people. Connected by purpose.<Icon name="heart" /></span></div></div></footer>
    {loginOpen && <LoginModal onClose={closeLogin} canRegister={canRegister} />}
    {post && <PostDetail item={post} onClose={closePost} />}
  </div>
}
