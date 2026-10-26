import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { api } from './api.js'
import 'leaflet/dist/leaflet.css'
import './IncidentReport.css'

const DEFAULT_MAP_CENTER = [-15.4167, 28.2833]

function LocationMarker({ position, onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng)
    },
  })

  if (!position) return null

  return (
    <CircleMarker center={position} radius={9} pathOptions={{ color: '#087d70', fillOpacity: 0.8 }}>
      <Popup>Selected incident location</Popup>
    </CircleMarker>
  )
}

function MapCenterUpdater({ position }) {
  const map = useMap()
  const latitude = position?.[0]
  const longitude = position?.[1]

  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      map.setView([latitude, longitude], Math.max(map.getZoom(), 12))
    }
  }, [latitude, longitude, map])

  return null
}

export default function IncidentReport({ onBack }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Flooding',
    location: '',
    province: '',
    district: '',
    latitude: '',
    longitude: '',
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [hasCoordinates, setHasCoordinates] = useState(false)
  const selectedPosition = hasCoordinates
    ? [Number(form.latitude), Number(form.longitude)]
    : null

  const setLocation = (latitude, longitude) => {
    setForm((previousForm) => ({
      ...previousForm,
      latitude: String(Number(latitude.toFixed(6))),
      longitude: String(Number(longitude.toFixed(6))),
    }))
    setHasCoordinates(true)
    setMessage('Incident location selected on the map.')
    setError('')
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }))
  }

  const handleLocation = () => {
    setError('')
    setMessage('')

    if (!navigator.geolocation) {
      setError('Your browser does not support location detection.')
      return
    }

    setLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords

        setLocation(latitude, longitude)
        setMessage('Your current location has been captured.')
        setLoading(false)
      },
      (locationError) => {
        let errorMessage = 'Unable to get your location.'

        if (locationError.code === locationError.PERMISSION_DENIED) {
          errorMessage =
            'Location permission was denied. Allow location access or try again.'
        } else if (
          locationError.code === locationError.POSITION_UNAVAILABLE
        ) {
          errorMessage = 'Your location is currently unavailable.'
        } else if (locationError.code === locationError.TIMEOUT) {
          errorMessage = 'Location detection timed out. Please try again.'
        }

        setError(errorMessage)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    try {
      const latitude = Number(form.latitude)
      const longitude = Number(form.longitude)

      if (
        !hasCoordinates ||
        form.latitude.trim() === '' ||
        form.longitude.trim() === '' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error(
          'Please capture your current location before submitting the report.'
        )
      }

      if (!form.title.trim()) {
        throw new Error('Please enter a report title.')
      }

      if (!form.description.trim()) {
        throw new Error('Please describe the incident.')
      }

      if (!form.province.trim()) {
        throw new Error('Please enter the province.')
      }

      if (!form.district.trim()) {
        throw new Error('Please enter the district.')
      }

      const categoryMap = {
        Flooding: 'FLOOD',
        Drought: 'DROUGHT',
        'Water supply disruption': 'WATER',
        'Damaged road or infrastructure': 'ROAD_DAMAGE',
        'Power outage': 'ELECTRICITY',
        'Food insecurity': 'OTHER',
        Other: 'OTHER',
      }

      const incident = {
        title: form.title.trim(),
        category: categoryMap[form.category] || 'OTHER',
        severity: 'MEDIUM',
        description: form.description.trim(),
        province: form.province.trim(),
        district: form.district.trim(),
        locationDetails: form.location.trim() || null,
        latitude,
        longitude,
        submissionMethod: 'WEB',
      }

      const result = await api.createIncident(incident)

      if (!result || result.success !== true) {
        throw new Error(
          result?.message || 'The incident report could not be submitted.'
        )
      }

      setMessage(
        result.message || 'Your incident report was submitted successfully.'
      )

      setForm({
        title: '',
        description: '',
        category: 'Flooding',
        location: '',
        province: '',
        district: '',
        latitude: '',
        longitude: '',
      })

      setHasCoordinates(false)
    } catch (submitError) {
      setError(
        submitError.message ||
          'Something went wrong while submitting your report. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="incident-report-page">
      <button className="incident-back" type="button" onClick={onBack}>
        ← Back to ShockReady
      </button>
      <section className="incident-report-container">
        <header className="incident-report-header">
          <h1>Report an Incident</h1>
          <p>
            Help your community respond to emergencies by reporting incidents
            and disruptions to essential services.
          </p>
        </header>

        {message && (
          <div className="success-message" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="incident-report-form">
          <div className="form-group">
            <label htmlFor="incident-title">Report title</label>
            <input
              id="incident-title"
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Flooding near the market"
              maxLength={150}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="incident-category">Incident category</label>
            <select
              id="incident-category"
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="Flooding">Flooding</option>
              <option value="Drought">Drought</option>
              <option value="Water supply disruption">
                Water supply disruption
              </option>
              <option value="Damaged road or infrastructure">
                Damaged road or infrastructure
              </option>
              <option value="Power outage">Power outage</option>
              <option value="Food insecurity">Food insecurity</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="incident-province">Province</label>
            <input
              id="incident-province"
              type="text"
              name="province"
              value={form.province}
              onChange={handleChange}
              placeholder="e.g. Copperbelt"
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="incident-district">District</label>
            <input
              id="incident-district"
              type="text"
              name="district"
              value={form.district}
              onChange={handleChange}
              placeholder="e.g. Kitwe"
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="incident-location">
              Community or nearby landmark
            </label>
            <input
              id="incident-location"
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g. Near the main market"
              maxLength={300}
            />
          </div>

          <div className="form-group">
            <label>Incident location</label>
            <p>
              Click the map to mark the incident location, or use your current
              location.
            </p>

            <div className="incident-location-map" aria-label="Select incident location on map">
              <MapContainer
                center={DEFAULT_MAP_CENTER}
                zoom={6}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenterUpdater position={selectedPosition} />
                <LocationMarker position={selectedPosition} onSelect={setLocation} />
              </MapContainer>
            </div>

            <button
              type="button"
              onClick={handleLocation}
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Use My Current Location'}
            </button>

            {hasCoordinates && (
              <div className="location-coordinates">
                <p>
                  <strong>Latitude:</strong> {form.latitude}
                </p>
                <p>
                  <strong>Longitude:</strong> {form.longitude}
                </p>
              </div>
            )}

            {!hasCoordinates && (
              <p className="location-hint">
              Click the map or use the location button to select a point.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="incident-description">
              Describe the incident
            </label>
            <textarea
              id="incident-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Explain what happened, who or what is affected, and any immediate risks."
              rows={5}
              maxLength={2000}
              required
            />
          </div>

          <button
            type="submit"
            className="submit-incident-button"
            disabled={loading}
          >
            {loading ? 'Submitting Report...' : 'Submit Incident Report'}
          </button>
        </form>
      </section>
    </main>
  )
}
