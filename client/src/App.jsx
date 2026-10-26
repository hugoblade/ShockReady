import './App.css'
import { useState, useEffect } from 'react'
import Auth from './Auth.jsx'
import IncidentReport from './IncidentReport.jsx'
import IncidentDashboard from './IncidentDashboard.jsx'
import SysAdminDashboard from './SysAdminDashboard.jsx'
import MunicipalityDashboard from './MunicipalityDashboard.jsx'
import VolunteerDashboard from './VolunteerDashboard.jsx'
import ResourceTracking from './ResourceTracking.jsx'
import OrganizationRegistration from './OrganizationRegistration.jsx'
import { api } from './api.js'

const steps = [
  {
    number: '01',
    title: 'Report',
    description: 'Share a local incident and mark where help is needed.',
    image: '/images/reporting-local-needs.jpg',
    imageAlt: 'Community members using a computer to share local information',
  },
  {
    number: '02',
    title: 'Verify',
    description: 'Help response teams understand what is happening on the ground.',
    image: '/images/community-review.jpg',
    imageAlt: 'A team meeting to review information and coordinate a response',
  },
  {
    number: '03',
    title: 'Respond',
    description: 'Coordinate people and essential resources where they can help.',
    image: '/images/community-response.jpg',
    imageAlt: 'A volunteer ready to support a community response',
  },
  {
    number: '04',
    title: 'Recover',
    description: 'Support community-led recovery and stronger preparation.',
    image: '/images/community-recovery.jpg',
    imageAlt: 'Hands protecting a young seedling as it grows',
  },
]

function App() {
  const [showAuth, setShowAuth] = useState(false)
  const [showIncidentReport, setShowIncidentReport] = useState(false)
  const [showOrganizationRegistration, setShowOrganizationRegistration] = useState(false)
  const [showIncidentDashboard, setShowIncidentDashboard] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true

    if (!api.hasSession()) return undefined

    api.getMe()
      .then(({ user }) => {
        if (active) setCurrentUser(user)
      })
      .catch((error) => {
        if (error.status === 401 || error.status === 403) {
          api.signOut()
        } else if (active) {
          setAuthError(error.message)
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function handleAuthenticated() {
    const { user } = await api.getMe()
    setCurrentUser(user)
    setAuthError('')
    setShowAuth(false)
    setShowIncidentDashboard(true)
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  if (showIncidentDashboard) {
    const onBack = () => setShowIncidentDashboard(false)
    if (currentUser?.role === 'SYSTEM_ADMIN') {
      return <SysAdminDashboard onBack={onBack} />
    }
    if (['ORG_ADMIN', 'MUNICIPAL_OFFICIAL'].includes(currentUser?.role)) {
      return <MunicipalityDashboard onBack={onBack} user={currentUser} />
    }
    if (currentUser?.role === 'RESPONDER') {
      return <VolunteerDashboard onBack={onBack} />
    }
    if (currentUser?.role === 'RESOURCE_COORDINATOR') {
      return <ResourceTracking onBack={onBack} />
    }
    if (currentUser?.role === 'NGO_STAFF') {
      return <MunicipalityDashboard onBack={onBack} user={currentUser} />
    }
    return <IncidentDashboard onBack={onBack} />
  }
  if (showIncidentReport) return <IncidentReport onBack={() => setShowIncidentReport(false)} />
  if (showOrganizationRegistration) {
    return <OrganizationRegistration onBack={() => setShowOrganizationRegistration(false)} />
  }
  if (showAuth) {
    return (
      <Auth
        onBack={() => setShowAuth(false)}
        onAuthenticated={handleAuthenticated}
      />
    )
  }
  return (
    <main className="site-shell">
      <header className="navbar">
        <a className="brand" href="#home" aria-label="ShockReady home">
          <img
            src={theme === 'light' ? '/logo-light.png' : '/logo-dark.png'}
            alt="ShockReady Logo"
            style={{ height: '45px', width: 'auto', objectFit: 'contain' }}
          />
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#mission">Our mission</a>
          <a href="#community">Community</a>
        </nav>

        <div className="nav-actions">
          <button onClick={toggleTheme} className="sign-in" style={{ background: 'transparent', border: '1px solid var(--accent-sage)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>

          {currentUser ? (
            <>
              <button
                className="sign-in"
                type="button"
                onClick={() => setShowIncidentDashboard(true)}
              >
                Operations dashboard
              </button>
              <button
                className="button button-small"
                type="button"
                onClick={() => {
                  api.signOut()
                  setCurrentUser(null)
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              className="button button-small"
              type="button"
              onClick={() => setShowAuth(true)}
            >
              Staff Portal <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </header>

      {authError && <p role="alert">{authError}</p>}
      {/* HERO SECTION */}
      <section className="hero-section" id="home">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            COMMUNITY-POWERED CLIMATE RESILIENCE
          </div>
          <h1>Every voice<br />matters. Every<br /><span>action counts.</span></h1>
          <p className="official-tagline">Turning Community Voices into Climate Action.</p>
          <p className="hero-description">From local reports to coordinated response, we’re helping communities prepare, respond and recover together.</p>
          <div className="hero-actions">
            <button className="button" type="button" onClick={() => setShowIncidentReport(true)}>Report an Issue</button>
            <button className="button button-light" type="button" onClick={() => setShowIncidentReport(true)}>Raise your voice <span aria-hidden="true">→</span></button>
            <a className="text-link" href="#how-it-works">Discover how it works <span aria-hidden="true">↗</span></a>
          </div>
          <div className="hero-note">
            <span className="note-icon" aria-hidden="true">✳</span>
            <span>Local knowledge. Collective action. Stronger communities.</span>
          </div>
        </div>

        <div className="hero-visual">
          <img src="/images/hero-community-farming.jpg" alt="Farm workers harvesting crops in a green field" className="hero-image" />
          <div className="visual-caption">
            <span className="caption-symbol">↗</span>
            <div>
              <strong>Resilience starts here.</strong>
              <p>One community. One shared purpose.</p>
              <a className="photo-credit" href="https://unsplash.com" target="_blank" rel="noreferrer">Photo via Unsplash</a>
            </div>
          </div>
          <span className="visual-label">BUILT FOR OUR COMMUNITIES</span>
        </div>
      </section>

      {/* OTHER LANDING PAGE SECTIONS (Keep your existing ones) */}
      <section className="impact-strip" id="community">
        <div className="impact-intro">
          <span className="section-kicker">WHY SHOCKREADY</span>
          <h2>When communities speak, action can follow.</h2>
        </div>
        <div className="impact-item">
          <span className="impact-icon">◎</span>
          <div><h3>Local voices</h3><p>Make community needs visible.</p></div>
        </div>
        <div className="impact-item">
          <span className="impact-icon">⌁</span>
          <div><h3>Coordinated action</h3><p>Help teams respond together.</p></div>
        </div>
        <div className="impact-item">
          <span className="impact-icon">↗</span>
          <div><h3>Stronger recovery</h3><p>Keep progress moving forward.</p></div>
        </div>
      </section>

      <section className="process-section" id="how-it-works">
        <div className="section-heading">
          <span className="section-kicker">FROM REPORT TO RESPONSE</span>
          <h2>A clearer path from challenge to action.</h2>
          <p>Climate disruptions can affect every part of daily life. ShockReady aims to make community reporting and coordinated response easier to follow.</p>
        </div>
        <div className="steps-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <img className="step-image" src={step.image} alt={step.imageAlt} loading="lazy" />
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span className="step-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="mission-section" id="mission">
        <div>
          <span className="section-kicker">OUR MISSION</span>
          <h2>Resilience is something we build together.</h2>
        </div>
        <p>We’re building towards a future where community reports can help decision-makers understand local needs, coordinate resources and support more accountable climate response.</p>
      </section>

      <section className="closing-section" id="get-started">
        <div>
          <span className="section-kicker">YOUR COMMUNITY. YOUR VOICE.</span>
          <h2>Better prepared. Better connected. Ready together.</h2>
          <p>Every meaningful response starts with understanding what is happening.</p>
        </div>
        <div className="closing-actions">
          <button className="button button-light" type="button" onClick={() => setShowIncidentReport(true)}>Report an issue <span aria-hidden="true">→</span></button>
          <button className="button button-outline-light" type="button" onClick={() => setShowOrganizationRegistration(true)}>Register an organization</button>
        </div>
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="#home">
          <img src={theme === 'light' ? '/logo-light.png' : '/logo-dark.png'} alt="ShockReady Logo" style={{ height: '35px', width: 'auto', objectFit: 'contain' }} />
        </a>
        <p>Turning Community Voices into Climate Action.</p>
        <span>Community resilience starts with us. · <a href="https://unsplash.com" target="_blank" rel="noreferrer">Photography via Unsplash</a></span>
      </footer>
    </main>
  )
}

export default App