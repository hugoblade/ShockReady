import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import './OperationsDashboard.css'

const initialStaffForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'RESPONDER',
}

export default function MunicipalityDashboard({ onBack, user }) {
  const [incidents, setIncidents] = useState([])
  const [staff, setStaff] = useState([])
  const [staffForm, setStaffForm] = useState(initialStaffForm)
  const [selectedResponders, setSelectedResponders] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [staffError, setStaffError] = useState('')
  const [notice, setNotice] = useState('')

  const canManageStaff = user?.role === 'ORG_ADMIN'
  const canAssignIncidents = ['ORG_ADMIN', 'MUNICIPAL_OFFICIAL'].includes(user?.role)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    const incidentRequest = api.getIncidents({ limit: 100 })
      .then((result) => setIncidents(result.incidents ?? []))
      .catch((loadError) => setError(loadError.message || 'Could not load incidents.'))

    const staffRequest = canAssignIncidents
      ? api.getStaff()
        .then((result) => {
          setStaff(result.staff ?? [])
          setStaffError('')
        })
        .catch((loadError) => setStaffError(loadError.message || 'Could not load staff.'))
      : Promise.resolve()

    await Promise.all([incidentRequest, staffRequest])
    setLoading(false)
  }, [canAssignIncidents])

  useEffect(() => {
    let active = true
    async function initialize() {
      const incidentRequest = api.getIncidents({ limit: 100 })
        .then((result) => {
          if (active) setIncidents(result.incidents ?? [])
        })
        .catch((loadError) => {
          if (active) setError(loadError.message || 'Could not load incidents.')
        })

      const staffRequest = canAssignIncidents
        ? api.getStaff()
          .then((result) => {
            if (active) setStaff(result.staff ?? [])
          })
          .catch((loadError) => {
            if (active) setStaffError(loadError.message || 'Could not load staff.')
          })
        : Promise.resolve()

      await Promise.all([incidentRequest, staffRequest])
      if (active) setLoading(false)
    }
    initialize()
    return () => {
      active = false
    }
  }, [canAssignIncidents])

  async function createStaff(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.createStaff(staffForm)
      setStaff((previous) => [result.staff, ...previous])
      setStaffForm(initialStaffForm)
      setNotice('Staff account created. They may need to confirm their email before signing in.')
    } catch (submitError) {
      setError(submitError.message || 'Could not create the staff account.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivateStaff(member) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.deactivateStaff(member.id)
      setStaff((previous) => previous.map((item) =>
        item.id === member.id ? { ...item, active: false } : item
      ))
      setNotice(`${member.fullName} has been deactivated.`)
    } catch (actionError) {
      setError(actionError.message || 'Could not deactivate this account.')
    } finally {
      setSaving(false)
    }
  }

  async function changeIncidentStatus(incident, newStatus) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.updateIncidentStatus(incident.id, newStatus)
      setNotice(`Incident status updated to ${newStatus.replaceAll('_', ' ').toLowerCase()}.`)
      await loadData()
    } catch (actionError) {
      setError(actionError.message || 'Could not update incident status.')
    } finally {
      setSaving(false)
    }
  }

  async function assignIncident(incident) {
    const responderId = selectedResponders[incident.id]
    if (!responderId) {
      setError('Select an active responder before assigning this incident.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.assignIncident(incident.id, responderId)
      setNotice('Incident assigned to the selected responder.')
      await loadData()
    } catch (actionError) {
      setError(actionError.message || 'Could not assign this incident.')
    } finally {
      setSaving(false)
    }
  }

  async function verifyIncident(incident, decision) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.verifyIncident(incident.id, decision)
      setNotice(`Incident ${decision.toLowerCase()}.`)
      await loadData()
    } catch (actionError) {
      setError(actionError.message || 'Could not record the verification decision.')
    } finally {
      setSaving(false)
    }
  }

  function renderIncidentActions(incident) {
    if (incident.status === 'REPORTED') {
      return <button className="operation-button operation-button-primary" disabled={saving} onClick={() => changeIncidentStatus(incident, 'UNDER_REVIEW')}>Start review</button>
    }
    if (incident.status === 'UNDER_REVIEW') {
      return (
        <div className="operations-actions">
          <button className="operation-button operation-button-primary" disabled={saving} onClick={() => verifyIncident(incident, 'VERIFIED')}>Verify</button>
          <button className="operation-button operation-button-danger" disabled={saving} onClick={() => verifyIncident(incident, 'REJECTED')}>Reject</button>
        </div>
      )
    }
    if (incident.status === 'VERIFIED' && canAssignIncidents) {
      const responders = staff.filter((member) => member.active && member.role === 'RESPONDER')
      return (
        <div className="operations-actions">
          <select
            aria-label={`Select responder for ${incident.title || incident.referenceNumber}`}
            value={selectedResponders[incident.id] || ''}
            onChange={(event) => setSelectedResponders((previous) => ({ ...previous, [incident.id]: event.target.value }))}
          >
            <option value="">Choose responder</option>
            {responders.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
          </select>
          <button className="operation-button operation-button-primary" disabled={saving || responders.length === 0} onClick={() => assignIncident(incident)}>Assign</button>
        </div>
      )
    }
    if (incident.status === 'ASSIGNED') {
      return <span className="operations-muted">Awaiting responder</span>
    }
    if (incident.status === 'IN_PROGRESS' && ['ORG_ADMIN', 'MUNICIPAL_OFFICIAL', 'RESPONDER'].includes(user?.role)) {
      return <button className="operation-button operation-button-primary" disabled={saving} onClick={() => changeIncidentStatus(incident, 'RESOLVED')}>Resolve</button>
    }
    return <span className="operations-muted">No action</span>
  }

  return (
    <main className="operations-page">
      <header className="operations-header">
        <button type="button" className="operation-button operation-button-secondary" onClick={onBack}>← Home</button>
        <p className="operations-eyebrow">FIELD OPERATIONS</p>
        <h1>{user?.role === 'NGO_STAFF' ? 'Response operations' : 'Municipality dashboard'}</h1>
        <p>Coordinate incident review and response for {user?.organization?.name || 'your organization'}.</p>
      </header>

      {(error || staffError) && <p className="operation-message operation-error" role="alert">{error || staffError}</p>}
      {notice && <p className="operation-message operation-success" role="status">{notice}</p>}

      {canManageStaff && (
        <section className="operations-panel">
          <div className="operations-panel-heading">
            <div><h2>Staff management</h2><p>Create response accounts and deactivate access.</p></div>
          </div>
          <form className="operations-form" onSubmit={createStaff}>
            <label>Full name<input required maxLength={120} value={staffForm.fullName} onChange={(event) => setStaffForm({ ...staffForm, fullName: event.target.value })} /></label>
            <label>Email<input required type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
            <label>Temporary password<input required type="password" minLength={8} value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /></label>
            <label>Role<select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}>
              <option value="RESPONDER">Responder</option>
              <option value="MUNICIPAL_OFFICIAL">Municipal official</option>
              <option value="NGO_STAFF">NGO staff</option>
              <option value="RESOURCE_COORDINATOR">Resource coordinator</option>
              <option value="ORG_ADMIN">Organization admin</option>
            </select></label>
            <label>Phone (optional)<input type="tel" value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} /></label>
            <button className="operation-button operation-button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create staff account'}</button>
          </form>
          {staff.length > 0 && (
            <div className="operations-table-wrap">
              <table className="operations-table">
                <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{staff.map((member) => (
                  <tr key={member.id}>
                    <td><strong>{member.fullName}</strong><small>{member.email}</small></td>
                    <td>{member.role.replaceAll('_', ' ')}</td>
                    <td>{member.active ? 'Active' : 'Inactive'}</td>
                    <td>{member.active && <button className="operation-button operation-button-danger" type="button" disabled={saving} onClick={() => deactivateStaff(member)}>Deactivate</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="operations-panel">
        <div className="operations-panel-heading">
          <div><h2>Incident overview</h2><p>Review reports, verify incidents, and coordinate responses.</p></div>
          <button className="operation-button operation-button-secondary" type="button" disabled={loading} onClick={loadData}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        {loading ? <p className="operations-empty">Loading incidents…</p> : incidents.length === 0 ? (
          <p className="operations-empty">No incidents are available.</p>
        ) : (
          <div className="operations-table-wrap">
            <table className="operations-table">
              <thead><tr><th>Incident</th><th>Area</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{incidents.map((incident) => (
                <tr key={incident.id}>
                  <td><strong>{incident.title || incident.referenceNumber}</strong><small>{incident.category.replaceAll('_', ' ')} · {incident.referenceNumber}</small></td>
                  <td>{[incident.district, incident.province].filter(Boolean).join(', ')}</td>
                  <td>{incident.severity}</td>
                  <td>{incident.status.replaceAll('_', ' ')}</td>
                  <td>{renderIncidentActions(incident)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
