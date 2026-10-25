import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { supabase } from './supabase'
import 'leaflet/dist/leaflet.css'
import './IncidentDashboard.css'

const DEFAULT_CENTER = [-15.4167, 28.2833]

export default function IncidentDashboard({ onBack }) {
  const [incidents, setIncidents] = useState([])
  const [publicIncidents, setPublicIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    let active = true

    async function loadIncidents() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!authData.user) throw new Error('Please sign in to view your reports.')

        const { data, error: queryError } = await supabase
          .from('incidents')
          .select('id, title, description, category, status, priority, latitude, longitude, created_at')
          .order('created_at', { ascending: false })

        if (queryError) throw queryError
        if (active) setIncidents(data ?? [])
      } catch (err) {
        if (active) setError(err.message || 'Could not load incident reports.')
      } finally {
        if (active) setLoading(false)
      }
    }

    async function loadPublicIncidents() {
      try {
        const { data, error: queryError } = await supabase
          .from('public_incidents')
          .select('*')

        if (queryError) throw queryError
        if (active) setPublicIncidents(data ?? [])
      } catch {
        if (active) setMapError('The public map will be available when the backend view is deployed.')
      } finally {
        if (active) setMapLoading(false)
      }
    }

    loadIncidents()
    loadPublicIncidents()

    return () => { active = false }
  }, [])

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">SHOCKREADY · COMMUNITY RESILIENCE</p>
          <h1>Incident dashboard</h1>
          <p>Track reported incidents and view verified public alerts.</p>
        </div>
        <button type="button" className="dashboard-back" onClick={onBack}>← Back</button>
      </header>

      <section className="dashboard-summary">
        <article className="dashboard-stat">
          <span>My visible reports</span>
          <strong>{loading ? '…' : incidents.length}</strong>
        </article>
        <article className="dashboard-stat">
          <span>Public map alerts</span>
          <strong>{mapLoading ? '…' : publicIncidents.length}</strong>
        </article>
      </section>

      <section className="dashboard-section">
        <h2>Verified public incident map</h2>
        <p className="dashboard-muted">Only incidents exposed by the public backend view appear here.</p>

        <div className="dashboard-map">
          <MapContainer center={DEFAULT_CENTER} zoom={6} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {publicIncidents.map((incident) => {
              const latitude = Number(incident.latitude)
              const longitude = Number(incident.longitude)
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
                  latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null

              return (
                <CircleMarker key={incident.id} center={[latitude, longitude]} radius={7}>
                  <Popup>
                    <strong>{incident.title || 'Verified incident'}</strong><br />
                    {incident.category}<br />
                    {incident.status}
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        {mapLoading && <p>Loading public alerts…</p>}
        {mapError && <p className="dashboard-notice">{mapError}</p>}
      </section>

      <section className="dashboard-section">
        <h2>Incident reports</h2>
        {loading && <p>Loading reports…</p>}
        {error && <p className="dashboard-error" role="alert">{error}</p>}
        {!loading && !error && incidents.length === 0 && (
          <p className="dashboard-muted">No visible reports yet.</p>
        )}

        <div className="incident-list">
          {incidents.map((incident) => (
            <article className="incident-item" key={incident.id}>
              <div className="incident-item-top">
                <span className="incident-category">{incident.category}</span>
                <span className="incident-status">{(incident.status || 'reported').replaceAll('_', ' ')}</span>
              </div>
              <h3>{incident.title}</h3>
              <p>{incident.description}</p>
              <small>Reported {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'date unavailable'}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
