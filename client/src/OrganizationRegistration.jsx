import { useState } from 'react'
import { api } from './api.js'
import './OperationsDashboard.css'

const initialForm = {
  name: '',
  type: 'MUNICIPALITY',
  email: '',
  phone: '',
  address: '',
  district: '',
  province: '',
}

export default function OrganizationRegistration({ onBack }) {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await api.registerOrganization({
        ...form,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        district: form.district.trim() || null,
        province: form.province.trim() || null,
      })
      setMessage(result.message || 'Organization registration submitted for approval.')
      setForm(initialForm)
    } catch (submitError) {
      setError(submitError.message || 'Could not submit the organization registration.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="operations-page">
      <section className="operations-panel operations-registration">
        <button type="button" className="operation-button operation-button-secondary" onClick={onBack}>← Back to ShockReady</button>
        <p className="operations-eyebrow">PARTNER WITH SHOCKREADY</p>
        <h1>Register your organization</h1>
        <p className="operations-muted">Registrations are reviewed by a platform administrator before operational accounts are enabled.</p>
        {error && <p className="operation-message operation-error" role="alert">{error}</p>}
        {message && <p className="operation-message operation-success" role="status">{message}</p>}
        <form className="operations-form" onSubmit={submit}>
          <label>Organization name<input required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Organization type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="MUNICIPALITY">Municipality</option>
            <option value="NGO">NGO</option>
            <option value="GOVERNMENT_AGENCY">Government agency</option>
            <option value="EMERGENCY_SERVICE">Emergency service</option>
            <option value="OTHER">Other</option>
          </select></label>
          <label>Contact email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Phone<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Province<input maxLength={100} value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} /></label>
          <label>District<input maxLength={100} value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></label>
          <label className="operations-form-wide">Address<input maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <button className="operation-button operation-button-primary" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit for approval'}</button>
        </form>
      </section>
    </main>
  )
}
