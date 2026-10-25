import { useState } from 'react'
import './IncidentReport.css'

export default function IncidentReport() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Flooding',
    location: '',
  })

  const [submitted, setSubmitted] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setSubmitted(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <main className="incident-page">
      <a className="incident-back" href="/">← ShockReady home</a>

      <section className="incident-card">
        <p className="incident-kicker">COMMUNITY RESILIENCE</p>
        <h1>Report an incident</h1>
        <p className="incident-intro">
          Help your community respond to climate hazards and essential-service disruptions.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="incident-title">Incident title</label>
          <input
            id="incident-title"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Flooded road near the market"
            required
          />

          <label htmlFor="incident-category">Incident category</label>
          <select
            id="incident-category"
            name="category"
            value={form.category}
            onChange={handleChange}
          >
            <option>Flooding</option>
            <option>Drought</option>
            <option>Water supply disruption</option>
            <option>Damaged road or infrastructure</option>
            <option>Power outage</option>
            <option>Food insecurity</option>
            <option>Other</option>
          </select>

          <label htmlFor="incident-location">Location or landmark</label>
          <input
            id="incident-location"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Enter the affected area"
            required
          />

          <label htmlFor="incident-description">What happened?</label>
          <textarea
            id="incident-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe the incident, its impact and help needed..."
            rows={5}
            required
          />

          <button className="incident-submit" type="submit">
            Preview incident report →
          </button>

          {submitted && (
            <div className="incident-preview" role="status">
              <h2>Report prepared successfully</h2>
              <p><strong>Title:</strong> {form.title}</p>
              <p><strong>Category:</strong> {form.category}</p>
              <p><strong>Location:</strong> {form.location}</p>
              <p><strong>Description:</strong> {form.description}</p>
              <p>This is a local preview. The report has not been sent to the backend.</p>
            </div>
          )}

          <p className="incident-note">
            Preview mode — reports are not yet saved to the ShockReady database.
          </p>
        </form>
      </section>
    </main>
  )
}
