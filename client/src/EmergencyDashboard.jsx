import { useMemo, useState } from 'react'
import './EmergencyDashboard.css'

const demoIncidents = [
  { id: 'INC-001', title: 'Flooded access road', category: 'Flood', area: 'Demo District A', priority: 'Critical', status: 'Awaiting response' },
  { id: 'INC-002', title: 'Community water shortage', category: 'Water', area: 'Demo District B', priority: 'High', status: 'In progress' },
  { id: 'INC-003', title: 'Storm damage to homes', category: 'Storm', area: 'Demo District C', priority: 'Medium', status: 'Monitoring' },
  { id: 'INC-004', title: 'Blocked drainage channel', category: 'Infrastructure', area: 'Demo District A', priority: 'High', status: 'In progress' },
]

const demoResources = [
  { name: 'Drinking water', quantity: '500 litres', status: 'In transit' },
  { name: 'Food packages', quantity: '80 packages', status: 'Delivered' },
  { name: 'Emergency fuel', quantity: '120 litres', status: 'Awaiting dispatch' },
  { name: 'Medical supplies', quantity: '25 kits', status: 'Delivered' },
]

function EmergencyDashboard({ onBack }) {
  const [incidents, setIncidents] = useState(demoIncidents)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const matchesFilter = filter === 'All' || incident.priority === filter
    const query = search.toLowerCase()
    const matchesSearch = `${incident.id} ${incident.title} ${incident.area} ${incident.category}`.toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  }), [incidents, filter, search])

  const criticalCount = incidents.filter((incident) => incident.priority === 'Critical').length
  const activeCount = incidents.filter((incident) => incident.status === 'In progress' || incident.status === 'Awaiting response').length
  const deliveredCount = demoResources.filter((resource) => resource.status === 'Delivered').length

  function updateStatus(id, status) {
    setIncidents((current) => current.map((incident) => incident.id === id ? { ...incident, status } : incident))
  }

  return (
    <main className="emergency-dashboard">
      <header className="emergency-header">
        <div className="emergency-header-top">
          <span className="emergency-brand">SHOCKREADY · EMERGENCY OPERATIONS</span>
          {onBack && <button className="emergency-back" onClick={onBack}>← Home</button>}
        </div>
        <h1>Emergency Response Dashboard</h1>
        <p>See reported emergencies, prioritize action, and monitor response progress.</p>
      </header>

      <section className="emergency-demo-notice">
        <strong>DEMO MODE</strong>
        <span>All incidents and resource figures on this page are sample data. Updates are temporary and are not saved to Supabase.</span>
      </section>

      <section className="emergency-stats" aria-label="Response overview">
        <article className="emergency-stat">
          <span>Total incidents</span>
          <strong>{incidents.length}</strong>
          <small>Sample reports</small>
        </article>
        <article className="emergency-stat">
          <span>Critical incidents</span>
          <strong>{criticalCount}</strong>
          <small>Require urgent review</small>
        </article>
        <article className="emergency-stat">
          <span>Active responses</span>
          <strong>{activeCount}</strong>
          <small>Awaiting action or in progress</small>
        </article>
        <article className="emergency-stat">
          <span>Resources delivered</span>
          <strong>{deliveredCount} / {demoResources.length}</strong>
          <small>Sample resource entries</small>
        </article>
      </section>

      <section className="emergency-section">
        <div className="emergency-section-heading">
          <div>
            <span className="emergency-eyebrow">SITUATION OVERVIEW</span>
            <h2>Incident priorities</h2>
            <p>Search sample reports and update their response status.</p>
          </div>
        </div>

        <div className="emergency-filters">
          <input
            aria-label="Search incidents"
            placeholder="Search by incident, area or category..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select aria-label="Filter by priority" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option>All</option>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
          </select>
        </div>

        <div className="emergency-table-wrap">
          <table className="emergency-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Area</th>
                <th>Priority</th>
                <th>Response status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <strong>{incident.title}</strong>
                    <small>{incident.id} · {incident.category}</small>
                  </td>
                  <td>{incident.area}</td>
                  <td><span className={`emergency-priority priority-${incident.priority.toLowerCase()}`}>{incident.priority}</span></td>
                  <td>
                    <select
                      aria-label={`Update status for ${incident.id}`}
                      value={incident.status}
                      onChange={(event) => updateStatus(incident.id, event.target.value)}
                    >
                      <option>Awaiting response</option>
                      <option>In progress</option>
                      <option>Monitoring</option>
                      <option>Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
              {filteredIncidents.length === 0 && (
                <tr><td colSpan="4" className="emergency-empty">No matching incidents found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="emergency-section">
        <div className="emergency-section-heading">
          <div>
            <span className="emergency-eyebrow">RELIEF OPERATIONS</span>
            <h2>Resource snapshot</h2>
            <p>A quick view of sample relief supplies and delivery status.</p>
          </div>
        </div>

        <div className="emergency-resources">
          {demoResources.map((resource) => (
            <article className="emergency-resource" key={resource.name}>
              <div className="emergency-resource-icon">+</div>
              <div className="emergency-resource-details">
                <strong>{resource.name}</strong>
                <span>{resource.quantity}</span>
              </div>
              <span className={`emergency-resource-status ${resource.status === 'Delivered' ? 'resource-delivered' : ''}`}>
                {resource.status}
              </span>
            </article>
          ))}
        </div>
      </section>

      <footer className="emergency-footer">
        <span>SHOCKREADY</span>
        <span>From climate warnings to coordinated action and accountable recovery.</span>
      </footer>
    </main>
  )
}

export default EmergencyDashboard
