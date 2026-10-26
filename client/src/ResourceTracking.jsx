import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import './ResourceTracking.css'

const emptyForm = {
  incidentId: '',
  resourceName: '',
  quantity: '',
  unit: 'Litres',
  destination: '',
  notes: '',
}

const statusLabels = {
  PREPARING: 'Preparing',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

const nextStatus = {
  PREPARING: 'DISPATCHED',
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
}

export default function ResourceTracking({ onBack }) {
  const [resources, setResources] = useState([])
  const [incidents, setIncidents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(emptyForm)

  const loadResources = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const incidentResult = await api.getIncidents({ limit: 100 })
      const incidentList = incidentResult.incidents ?? []
      setIncidents(incidentList)
      const dispatchResult = await api.getMyResourceDispatches()
      setResources((dispatchResult.dispatches ?? []).map((dispatch) => ({
        ...dispatch,
        incidentId: dispatch.incidentId,
        incidentTitle: dispatch.incident.title || dispatch.incident.referenceNumber,
      })))
    } catch (loadError) {
      setError(loadError.message || 'Could not load resource dispatches.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function initialize() {
      setLoading(true)
      try {
        const incidentResult = await api.getIncidents({ limit: 100 })
        const incidentList = incidentResult.incidents ?? []
        const dispatchResult = await api.getMyResourceDispatches()
        if (active) {
          setIncidents(incidentList)
          setResources((dispatchResult.dispatches ?? []).map((dispatch) => ({
            ...dispatch,
            incidentId: dispatch.incidentId,
            incidentTitle: dispatch.incident.title || dispatch.incident.referenceNumber,
          })))
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load resource dispatches.')
      } finally {
        if (active) setLoading(false)
      }
    }
    initialize()
    return () => {
      active = false
    }
  }, [])

  const delivered = resources.filter((resource) => resource.status === 'DELIVERED').length
  const inTransit = resources.filter((resource) => resource.status === 'IN_TRANSIT').length
  const filtered = useMemo(() => resources.filter((resource) => {
    const query = search.toLowerCase().trim()
    const matchesSearch = `${resource.resourceName} ${resource.destination} ${resource.incidentTitle}`
      .toLowerCase().includes(query)
    const matchesFilter = filter === 'All' || statusLabels[resource.status] === filter
    return matchesSearch && matchesFilter
  }), [resources, search, filter])

  async function addResource(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.createResourceDispatch(form.incidentId, {
        resourceName: form.resourceName.trim(),
        quantity: Number(form.quantity),
        unit: form.unit,
        destination: form.destination.trim(),
        notes: form.notes.trim() || undefined,
      })
      const incident = incidents.find((item) => item.id === form.incidentId)
      setResources((previous) => [{
        ...result.dispatch,
        incidentId: form.incidentId,
        incidentTitle: incident?.title || incident?.referenceNumber || 'Incident',
      }, ...previous])
      setForm(emptyForm)
      setShowForm(false)
      setNotice('Resource dispatch created in preparing status.')
    } catch (submitError) {
      setError(submitError.message || 'Could not create this resource dispatch.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(resource, status) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.updateResourceDispatchStatus(resource.id, status)
      setResources((previous) => previous.map((item) =>
        item.id === resource.id
          ? { ...item, status, ...(status === 'DISPATCHED' ? { dispatchedAt: new Date().toISOString() } : {}), ...(status === 'DELIVERED' ? { deliveredAt: new Date().toISOString() } : {}) }
          : item
      ))
      setNotice(`Dispatch status updated to ${statusLabels[status].toLowerCase()}.`)
    } catch (actionError) {
      setError(actionError.message || 'Could not update dispatch status.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmReceipt(resource) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.confirmResourceReceipt(resource.id, {
        status: 'CONFIRMED',
        quantityReceived: resource.quantity,
      })
      setNotice('Receipt confirmation recorded.')
    } catch (actionError) {
      setError(actionError.message || 'Could not confirm receipt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="resource-page">
      <button type="button" className="resource-back" onClick={onBack}>← Back to ShockReady</button>

      <header className="resource-header">
        <div>
          <p className="resource-eyebrow">EMERGENCY RESPONSE</p>
          <h1>Resource tracking</h1>
          <p className="resource-subtitle">Coordinate accountable relief dispatches against verified incidents.</p>
        </div>
        <button className="resource-primary" type="button" onClick={() => setShowForm((current) => !current)}>
          {showForm ? 'Cancel' : '+ Record resource'}
        </button>
      </header>

      {error && <p className="resource-notice resource-error" role="alert">{error}</p>}
      {notice && <p className="resource-notice" role="status">{notice}</p>}

      <section className="resource-stats">
        <article className="resource-stat"><span>RESOURCE DISPATCHES</span><strong>{resources.length}</strong><small>Recorded dispatches</small></article>
        <article className="resource-stat"><span>DELIVERED</span><strong>{delivered}</strong><small>Marked as delivered</small></article>
        <article className="resource-stat"><span>IN TRANSIT</span><strong>{inTransit}</strong><small>Currently on the way</small></article>
      </section>

      {showForm && (
        <section className="resource-panel">
          <h2>Record a resource dispatch</h2>
          <form className="resource-form" onSubmit={addResource}>
            <label>Incident
              <select required value={form.incidentId} onChange={(event) => setForm({ ...form, incidentId: event.target.value })}>
                <option value="">Select a verified or active incident</option>
                {incidents.filter((incident) => ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS'].includes(incident.status)).map((incident) => (
                  <option key={incident.id} value={incident.id}>{incident.title || incident.referenceNumber} · {incident.district}</option>
                ))}
              </select>
            </label>
            <label>Resource name<input required maxLength={150} value={form.resourceName} onChange={(event) => setForm({ ...form, resourceName: event.target.value })} placeholder="e.g. Emergency food packages" /></label>
            <label>Quantity<input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
            <label>Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>Litres</option><option>Packages</option><option>Boxes</option><option>Items</option><option>Units</option><option>ZMW</option></select></label>
            <label>Destination<input required maxLength={300} value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="Community or facility" /></label>
            <label>Notes (optional)<input maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <button className="resource-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create dispatch'}</button>
          </form>
          {incidents.filter((incident) => ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS'].includes(incident.status)).length === 0 && (
            <p className="resource-help">There are no verified or active incidents available for dispatch.</p>
          )}
        </section>
      )}

      <section className="resource-panel">
        <div className="operations-panel-heading">
          <div><h2>Resource movements</h2><p className="resource-help">Update dispatch progress and confirm receipt.</p></div>
          <button className="operation-button operation-button-secondary" type="button" onClick={loadResources} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        <div className="resource-filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resources or destinations..." aria-label="Search resources" />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter status">
            <option>All</option><option>Preparing</option><option>Dispatched</option><option>In transit</option><option>Delivered</option><option>Cancelled</option>
          </select>
        </div>
        {loading ? <p className="resource-help">Loading resource dispatches…</p> : (
          <div className="resource-table-wrap">
            <table className="resource-table">
              <thead><tr><th>Resource</th><th>Quantity</th><th>Destination</th><th>Incident</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((resource) => (
                  <tr key={resource.id}>
                    <td><strong>{resource.resourceName}</strong><small>{resource.unit || 'Units'}</small></td>
                    <td>{Number(resource.quantity).toLocaleString()}</td>
                    <td>{resource.destination}</td>
                    <td>{resource.incidentTitle}</td>
                    <td><span className={`resource-status ${statusLabels[resource.status]?.toLowerCase().replace(' ', '-')}`}>{statusLabels[resource.status] || resource.status}</span></td>
                    <td className="operations-actions">
                      {nextStatus[resource.status] && <button className="operation-button operation-button-primary" type="button" disabled={saving} onClick={() => updateStatus(resource, nextStatus[resource.status])}>Mark {statusLabels[nextStatus[resource.status]].toLowerCase()}</button>}
                      {['IN_TRANSIT', 'DELIVERED'].includes(resource.status) && !resource.confirmations?.length && <button className="operation-button operation-button-secondary" type="button" disabled={saving} onClick={() => confirmReceipt(resource)}>Confirm receipt</button>}
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="6" className="resource-empty">{resources.length ? 'No dispatches match your search.' : 'No resource dispatches have been recorded.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
