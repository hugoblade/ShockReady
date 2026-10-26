import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import './OperationsDashboard.css'

export default function SysAdminDashboard({ onBack }) {
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadOrganizations = useCallback(async () => {
    setError('')
    try {
      const result = await api.getPendingOrganizations()
      setOrganizations(result.organizations ?? [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load pending organizations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function initialize() {
      const result = await api.getPendingOrganizations().catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load pending organizations.')
        return null
      })
      if (active && result) setOrganizations(result.organizations ?? [])
      if (active) setLoading(false)
    }
    initialize()
    return () => {
      active = false
    }
  }, [])

  async function reviewOrganization(organization, status) {
    setSavingId(organization.id)
    setError('')
    setNotice('')
    try {
      await api.updateOrganizationApproval(organization.id, status)
      setNotice(`${organization.name} ${status.toLowerCase()}.`)
      await loadOrganizations()
    } catch (reviewError) {
      setError(reviewError.message || 'Could not update organization approval.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <main className="operations-page">
      <header className="operations-header">
        <button type="button" className="operation-button operation-button-secondary" onClick={onBack}>
          ← Home
        </button>
        <p className="operations-eyebrow">PLATFORM ADMINISTRATION</p>
        <h1>Organization approvals</h1>
        <p>Review registrations before organizations can access operational tools.</p>
      </header>

      <section className="operations-panel">
        <div className="operations-panel-heading">
          <div>
            <h2>Pending organizations</h2>
            <p>{organizations.length} waiting for review</p>
          </div>
          <button type="button" className="operation-button operation-button-secondary" onClick={loadOrganizations} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {error && <p className="operation-message operation-error" role="alert">{error}</p>}
        {notice && <p className="operation-message operation-success" role="status">{notice}</p>}
        {loading ? (
          <p className="operations-empty">Loading organization registrations…</p>
        ) : organizations.length === 0 ? (
          <p className="operations-empty">There are no pending registrations.</p>
        ) : (
          <div className="operations-table-wrap">
            <table className="operations-table">
              <thead>
                <tr><th>Organization</th><th>Type</th><th>Contact</th><th>Location</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td><strong>{organization.name}</strong><small>{organization.createdAt ? new Date(organization.createdAt).toLocaleDateString() : ''}</small></td>
                    <td>{organization.type.replaceAll('_', ' ')}</td>
                    <td>{organization.email || organization.phone || 'Not provided'}</td>
                    <td>{[organization.district, organization.province].filter(Boolean).join(', ') || 'Not provided'}</td>
                    <td className="operations-actions">
                      <button type="button" className="operation-button operation-button-primary" disabled={savingId === organization.id} onClick={() => reviewOrganization(organization, 'APPROVED')}>
                        {savingId === organization.id ? 'Saving…' : 'Approve'}
                      </button>
                      <button type="button" className="operation-button operation-button-danger" disabled={savingId === organization.id} onClick={() => reviewOrganization(organization, 'REJECTED')}>
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
