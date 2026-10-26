export default function MunicipalityDashboard({ onBack }) {
    return (
        <div style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
            <button onClick={onBack} className="button button-small" style={{ marginBottom: '20px' }}>← Back to Home</button>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ color: 'var(--accent-teal)' }}>Municipality Dashboard</h1>

                <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                    <div style={{ flex: 1, padding: '20px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                        <h3>Staff Management</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create accounts for responders.</p>
                        <button className="button button-small">+ Create Staff Account</button>
                    </div>
                    <div style={{ flex: 1, padding: '20px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                        <h3>Incident Overview</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>View and assign open incidents.</p>
                        <button className="button button-small">View Map</button>
                    </div>
                </div>
            </div>
        </div>
    );
}