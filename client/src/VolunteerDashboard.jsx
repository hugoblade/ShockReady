import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import './OperationsDashboard.css'

export default function VolunteerDashboard({ onBack }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadAssignments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.getMyAssignments()
      setAssignments(result.assignments ?? [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load assigned response tasks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const result = await api.getMyAssignments()
        if (active) setAssignments(result.assignments ?? [])
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load assigned response tasks.')
      } finally {
        if (active) setLoading(false)
      }
    }
    initialize()
    return () => {
      active = false
    }
  }, [])

  async function updateAssignment(assignment) {
    setSavingId(assignment.id)
    setError('')
    setNotice('')
    try {
      if (assignment.status === 'ASSIGNED') {
        await api.acceptAssignment(assignment.id)
        setNotice('Task accepted.')
      } else if (assignment.status === 'ACCEPTED') {
        await api.startIncidentResponse(assignment.id)
        setNotice('Response started.')
      } else {
        await api.updateIncidentStatus(assignment.incidentId, 'RESOLVED')
        setNotice('Incident marked as resolved.')
      }
      await loadAssignments()
    } catch (actionError) {
      setError(actionError.message || 'Could not update this response task.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <main className="operations-page">
      <header className="operations-header">
        <button type="button" className="operation-button operation-button-secondary" onClick={onBack}>← Home</button>
        <p className="operations-eyebrow">COMMUNITY RESPONSE</p>
        <h1>My response tasks</h1>
        <p>Accept assignments, start response, and record completion.</p>
      </header>

      {error && <p className="operation-message operation-error" role="alert">{error}</p>}
      {notice && <p className="operation-message operation-success" role="status">{notice}</p>}
      <section className="operations-panel">
        <div className="operations-panel-heading">
          <div><h2>Assigned incidents</h2><p>Tasks are loaded from your responder account.</p></div>
          <button className="operation-button operation-button-secondary" type="button" onClick={loadAssignments} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        {loading ? <p className="operations-empty">Loading your assignments…</p> : assignments.length === 0 ? (
          <p className="operations-empty">No active assignments right now.</p>
        ) : assignments.map((assignment) => (
          <article className="operations-task" key={assignment.id}>
            <div>
              <span className="operations-status">{assignment.status.replaceAll('_', ' ')}</span>
              <h3>{assignment.incident.title || assignment.incident.referenceNumber}</h3>
              <p>{assignment.incident.description}</p>
              <small>{[assignment.incident.community, assignment.incident.district, assignment.incident.province].filter(Boolean).join(', ')}</small>
            </div>
            <button
              className="operation-button operation-button-primary"
              type="button"
              disabled={savingId === assignment.id}
              onClick={() => updateAssignment(assignment)}
            >
              {savingId === assignment.id ? 'Saving…' : assignment.status === 'ASSIGNED' ? 'Accept task' : assignment.status === 'ACCEPTED' ? 'Start response' : 'Mark resolved'}
            </button>
          </article>
        ))}
      </section>
    </main>
  )
}
