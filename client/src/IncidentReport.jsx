import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './supabase'
import './IncidentReport.css'

const DEFAULT_CENTER = [-15.4167, 28.2833]

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    },
  })

  return null
}

function RecenterMap({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position) {
      map.flyTo([position.latitude, position.longitude], 15)
    }
  }, [map, position])

  return null
}

export default function IncidentReport() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Flooding',
    location: '',
    latitude: '',
    longitude: '',
  })

  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const hasCoordinates =
    form.latitude.trim() !== '' &&
    form.longitude.trim() !== ''

  const position = hasCoordinates
    ? {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      }
    : null

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setMessage('')
    setError('')
  }

  function selectLocation(coords) {
    setForm((current) => ({
      ...current,
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
    }))
    setMessage('')
    setError('')
  }

  function useCurrentLocation() {
    setError('')
    setMessage('')

    if (!navigator.geolocation) {
      setError('Your browser does not support location detection. Please tap the map to select a location.')
      return
    }

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (result) => {
        selectLocation({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        })
        setLocating(false)
      },
      (locationError) => {
        const explanation =
          locationError.code === 1
            ? 'Location permission was denied. Allow location access in your browser, or tap the map to select the incident location.'
            : locationError.code === 2
              ? 'Your location could not be determined. Try again or tap the map.'
              : 'Location detection timed out. Try again or tap the map.'

        setError(explanation)
        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError

      const user = authData.user

      if (!user) {
        throw new Error('Please sign in before submitting an incident report.')
      }

      const latitude = Number(form.latitude)
      const longitude = Number(form.longitude)

      if (
        !hasCoordinates ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error('Please select the incident location on the map or use your current location.')
      }

      const { error: insertError } = await supabase
        .from('incidents')
        .insert({
          reporter_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          location: `SRID=4326;POINT(${longitude} ${latitude})`,
        })

      if (insertError) throw insertError

      setMessage('Incident report submitted successfully.')
      setForm({
        title: '',
        description: '',
        category: 'Flooding',
        location: '',
        latitude: '',
        longitude: '',
      })
    } catch (err) {
      setError(
        err.message ||
          'We could not submit your report. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="incident-page">
      <a className="incident-back" href="/">
        ← ShockReady home
      </a>

      <section className="incident-card">
        <p className="incident-kicker">COMMUNITY RESILIENCE</p>
        <h1>Report an incident</h1>
        <p className="incident-intro">
          Help your community respond to climate hazards and
          essential-service disruptions.
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
            placeholder="e.g. near the main market"
            required
          />

          <label>Pin the incident location</label>
          <p className="incident-note">
            Tap the map where the incident happened, or use your
            current location. Tap again to move the pin.
          </p>

          <button
            className="incident-location-button"
            type="button"
            onClick={useCurrentLocation}
            disabled={locating || loading}
          >
            {locating
              ? 'Finding your location...'
              : '◎ Use my current location'}
          </button>

          <div className="incident-location-map">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={6}
              scrollWheelZoom
              className="incident-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapClickHandler onSelect={selectLocation} />
              <RecenterMap position={position} />

              {position && (
                <Marker
                  position={[position.latitude, position.longitude]}
                />
              )}
            </MapContainer>
          </div>

          <p
            className={
              position
                ? 'incident-location-status selected'
                : 'incident-location-status'
            }
            role="status"
          >
            {position
              ? `Location selected: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
              : 'No location selected yet.'}
          </p>

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

          {error && (
            <p className="auth-message auth-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-message auth-success" role="status">
              {message}
            </p>
          )}

          <button
            className="incident-submit"
            type="submit"
            disabled={loading || locating}
          >
            {loading ? 'Submitting report...' : 'Submit incident report →'}
          </button>

          <p className="incident-note">
            Your report is submitted only when the database confirms success.
          </p>
        </form>
      </section>
    </main>
  )
}