import IncidentDashboard from './IncidentDashboard.jsx'
import './App.css'
import { useState, useEffect } from 'react'
import Auth from './Auth.jsx'
import IncidentReport from './IncidentReport.jsx'
import ResourceTracking from './ResourceTracking.jsx'
import CommunityCorps from './CommunityCorps.jsx'
import EmergencyDashboard from './EmergencyDashboard.jsx'

const steps = [
  {
    number: '01',
    title: 'Report',
    description:
      'Give your community a voice. Report floods, damaged infrastructure and other local disruptions.',
  },
  {
    number: '02',
    title: 'Verify',
    description:
      'Help response teams identify genuine incidents and understand where support is needed most.',
  },
  {
    number: '03',
    title: 'Respond',
    description:
      'Connect verified reports with the people and resources needed to take action.',
  },
  {
    number: '04',
    title: 'Recover',
    description:
      'Follow progress and help communities move towards safer, stronger futures.',
  },
]

function App() {
  const [showAuth, setShowAuth] = useState(false)
  const [showIncidentReport, setShowIncidentReport] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showResourceTracking, setShowResourceTracking] = useState(false)
  const [showCommunityCorps, setShowCommunityCorps] = useState(false)
  const [showEmergencyDashboard, setShowEmergencyDashboard] = useState(false)

  // THEME STATE
  const [theme, setTheme] = useState('light')

  // APPLY THEME
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  // ROUTING LOGIC
  if (showDashboard) return <IncidentDashboard onBack={() => setShowDashboard(false)} />
  if (showResourceTracking) return <ResourceTracking onBack={() => setShowResourceTracking(false)} />
  if (showCommunityCorps) return <CommunityCorps onBack={() => setShowCommunityCorps(false)} />
  if (showEmergencyDashboard) return <EmergencyDashboard onBack={() => setShowEmergencyDashboard(false)} />
  if (showIncidentReport) return <IncidentReport onBack={() => setShowIncidentReport(false)} />
  if (showAuth) return <Auth onBack={() => setShowAuth(false)} />

  return (
    <main className="site-shell">
      <header className="navbar">
        {/* 👇 TOP NAVBAR LOGO GOES HERE 👇 */}
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
          {/* THEME TOGGLE BUTTON */}
          <button
            onClick={toggleTheme}
            className="sign-in"
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-sage)',
              color: 'var(--text-main)',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>

          {/* NEW PAGE ROUTES */}
          <button className="sign-in" type="button" onClick={() => setShowDashboard(true)}>Dashboard</button>
          <button className="sign-in" type="button" onClick={() => setShowResourceTracking(true)}>Resources</button>
          <button className="sign-in" type="button" onClick={() => setShowCommunityCorps(true)}>Corps</button>
          <button className="sign-in" type="button" onClick={() => setShowEmergencyDashboard(true)}>Emergency</button>

          <a
            className="sign-in"
            href="#sign-in"
            onClick={(event) => {
              event.preventDefault()
              setShowAuth(true)
            }}
          >
            Sign in
          </a>

          <a
            className="button button-small"
            href="#get-started"
            onClick={(event) => {
              event.preventDefault()
              setShowAuth(true)
            }}
          >
            Get started <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            COMMUNITY-POWERED CLIMATE RESILIENCE
          </div>

          <h1>
            Every voice
            <br />
            matters. Every
            <br />
            <span>action counts.</span>
          </h1>

          <p className="official-tagline">
            Turning Community Voices into Climate Action.
          </p>

          <p className="hero-description">
            From local reports to coordinated response, we’re helping
            communities prepare, respond and recover together.
          </p>

          <div className="hero-actions">
            <a
              className="button"
              href="#get-started"
              onClick={(event) => {
                event.preventDefault()
                setShowAuth(true)
              }}
            >
              Get Started
            </a>

            <button
              className="button"
              type="button"
              onClick={() => setShowIncidentReport(true)}
            >
              Raise your voice <span aria-hidden="true">→</span>
            </button>

            <a className="text-link" href="#how-it-works">
              Discover how it works <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="hero-note">
            <span className="note-icon" aria-hidden="true">✳</span>
            <span>Local knowledge. Collective action. Stronger communities.</span>
          </div>
        </div>

        <div className="hero-visual" role="img" aria-label="Illustration of a green landscape with hills, trees and a rising sun">
          <div className="visual-sun" />
          <div className="visual-cloud cloud-one" />
          <div className="visual-cloud cloud-two" />
          <div className="hill hill-back" />
          <div className="hill hill-middle" />
          <div className="hill hill-front" />

          <div className="tree tree-one"><span /></div>
          <div className="tree tree-two"><span /></div>
          <div className="tree tree-three"><span /></div>

          <div className="visual-caption">
            <span className="caption-symbol">↗</span>
            <div>
              <strong>Resilience starts here.</strong>
              <p>One community. One shared purpose.</p>
            </div>
          </div>

          <span className="visual-label">BUILT FOR OUR COMMUNITIES</span>
        </div>
      </section>

      <section className="impact-strip" id="community">
        <div className="impact-intro">
          <span className="section-kicker">WHY SHOCKREADY</span>
          <h2>When communities speak, action can follow.</h2>
        </div>
        <div className="impact-item">
          <span className="impact-icon" aria-hidden="true">◎</span>
          <div>
            <h3>Local voices</h3>
            <p>Make community needs visible.</p>
          </div>
        </div>
        <div className="impact-item">
          <span className="impact-icon" aria-hidden="true">⌁</span>
          <div>
            <h3>Coordinated action</h3>
            <p>Help teams respond together.</p>
          </div>
        </div>
        <div className="impact-item">
          <span className="impact-icon" aria-hidden="true">↗</span>
          <div>
            <h3>Stronger recovery</h3>
            <p>Keep progress moving forward.</p>
          </div>
        </div>
      </section>

      <section className="process-section" id="how-it-works">
        <div className="section-heading">
          <span className="section-kicker">FROM REPORT TO RESPONSE</span>
          <h2>A clearer path from challenge to action.</h2>
          <p>
            Climate disruptions can affect every part of daily life.
            ShockReady aims to make community reporting and coordinated
            response easier to follow.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span className="step-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="mission-section" id="mission">
        <div>
          <span className="section-kicker">OUR MISSION</span>
          <h2>Resilience is something we build together.</h2>
        </div>
        <p>
          We’re building towards a future where community reports can help
          decision-makers understand local needs, coordinate resources and
          support more accountable climate response.
        </p>
      </section>

      <section className="closing-section" id="get-started">
        <div>
          <span className="section-kicker">YOUR COMMUNITY. YOUR VOICE.</span>
          <h2>Better prepared. Better connected. Ready together.</h2>
          <p>Every meaningful response starts with understanding what is happening.</p>
        </div>
        <a className="button button-light" href="#home">
          Explore ShockReady <span aria-hidden="true">↑</span>
        </a>
      </section>

      <footer className="footer">
        {/* 👇 FOOTER LOGO GOES HERE 👇 */}
        <a className="brand footer-brand" href="#home">
          <img
            src={theme === 'light' ? '/logo-light.png' : '/logo-dark.png'}
            alt="ShockReady Logo"
            style={{ height: '35px', width: 'auto', objectFit: 'contain' }}
          />
        </a>
        <p>Turning Community Voices into Climate Action.</p>
        <span>Community resilience starts with us.</span>
      </footer>
    </main>
  )
}

export default App