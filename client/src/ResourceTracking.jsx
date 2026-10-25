import { useState } from 'react'
import './ResourceTracking.css'

const demoResources = [
  { id: 1, item: 'Clean water', type: 'Water', quantity: 500, unit: 'Litres', destination: 'Community A', status: 'In transit', date: '2026-10-25' },
  { id: 2, item: 'Food packages', type: 'Food', quantity: 80, unit: 'Packages', destination: 'Community B', status: 'Delivered', date: '2026-10-24' },
  { id: 3, item: 'Emergency fuel', type: 'Fuel', quantity: 120, unit: 'Litres', destination: 'District Store', status: 'Dispatched', date: '2026-10-25' },
]

export default function ResourceTracking() {
  const [resources, setResources] = useState(demoResources)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    item: '',
    type: 'Water',
    quantity: '',
    unit: 'Litres',
    destination: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const delivered = resources.filter(r => r.status === 'Delivered').length
  const inTransit = resources.filter(r => r.status === 'In transit').length

  const filtered = resources.filter(r => {
    const matchesSearch = `${r.item} ${r.destination} ${r.type}`
      .toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (filter === 'All' || r.status === filter)
  })

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  function addResource(event) {
    event.preventDefault()
    setResources([
      {
        ...form,
        id: Date.now(),
        quantity: Number(form.quantity),
        status: 'Dispatched',
      },
      ...resources,
    ])
    setForm({
      item: '',
      type: 'Water',
      quantity: '',
      unit: 'Litres',
      destination: '',
      date: new Date().toISOString().slice(0, 10),
    })
    setShowForm(false)
    setNotice('Resource entry added to this demo.')
  }

  function updateStatus(id, status) {
    setResources(resources.map(r => r.id === id ? { ...r, status } : r))
    setNotice('Resource status updated in this demo.')
  }

  return (
    <main className="resource-page">
      <a href="/" className="resource-back">← ShockReady home</a>

      <header className="resource-header">
        <div>
          <p className="resource-eyebrow">EMERGENCY RESPONSE</p>
          <h1>Resource Tracking</h1>
          <p className="resource-subtitle">
            Track relief supplies from dispatch to delivery.
          </p>
        </div>
        <button className="resource-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Record resource'}
        </button>
      </header>

      <div className="resource-demo-notice">
        <strong>Demo mode:</strong> Sample data only. Changes are temporary and are not saved to Supabase.
      </div>

      {notice && <p className="resource-notice" role="status">{notice}</p>}

      <section className="resource-stats">
        <article className="resource-stat">
          <span>RESOURCE ENTRIES</span>
          <strong>{resources.length}</strong>
          <small>Total recorded entries</small>
        </article>
        <article className="resource-stat">
          <span>DELIVERED</span>
          <strong>{delivered}</strong>
          <small>Marked as delivered</small>
        </article>
        <article className="resource-stat">
          <span>IN TRANSIT</span>
          <strong>{inTransit}</strong>
          <small>Currently on the way</small>
        </article>
      </section>

      {showForm && (
        <section className="resource-panel">
          <h2>Record a resource dispatch</h2>
          <form className="resource-form" onSubmit={addResource}>
            <label>Resource name
              <input name="item" value={form.item} onChange={handleChange}
                placeholder="e.g. Emergency food packages" required />
            </label>
            <label>Resource type
              <select name="type" value={form.type} onChange={handleChange}>
                <option>Water</option>
                <option>Food</option>
                <option>Fuel</option>
                <option>Equipment</option>
                <option>Medical supplies</option>
                <option>Funding</option>
                <option>Other</option>
              </select>
            </label>
            <label>Quantity
              <input name="quantity" type="number" min="1" value={form.quantity}
                onChange={handleChange} placeholder="Enter quantity" required />
            </label>
            <label>Unit
              <select name="unit" value={form.unit} onChange={handleChange}>
                <option>Litres</option>
                <option>Packages</option>
                <option>Boxes</option>
                <option>Items</option>
                <option>Units</option>
                <option>ZMW</option>
              </select>
            </label>
            <label>Destination
              <input name="destination" value={form.destination} onChange={handleChange}
                placeholder="Community or facility" required />
            </label>
            <label>Dispatch date
              <input name="date" type="date" value={form.date}
                onChange={handleChange} required />
            </label>
            <button className="resource-primary" type="submit">Add resource entry</button>
          </form>
        </section>
      )}

      <section className="resource-panel">
        <h2>Resource movements</h2>
        <p className="resource-help">Search deliveries and update their status.</p>

        <div className="resource-filters">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search resources or destinations..." aria-label="Search resources" />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            aria-label="Filter status">
            <option>All</option>
            <option>Dispatched</option>
            <option>In transit</option>
            <option>Delivered</option>
          </select>
        </div>

        <div className="resource-table-wrap">
          <table className="resource-table">
            <thead>
              <tr>
                <th>Resource</th><th>Quantity</th><th>Destination</th>
                <th>Date</th><th>Status</th><th>Update</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.item}</strong><small>{r.type}</small></td>
                  <td>{Number(r.quantity).toLocaleString()} {r.unit}</td>
                  <td>{r.destination}</td>
                  <td>{r.date}</td>
                  <td><span className={`resource-status ${r.status.toLowerCase().replace(' ', '-')}`}>{r.status}</span></td>
                  <td>
                    <select value={r.status} aria-label={`Update ${r.item} status`}
                      onChange={e => updateStatus(r.id, e.target.value)}>
                      <option>Dispatched</option>
                      <option>In transit</option>
                      <option>Delivered</option>
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" className="resource-empty">No matching resources found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="resource-help">
          The connected version will need to record dispatch, receipt, and distribution for accountability.
        </p>
      </section>
    </main>
  )
}
