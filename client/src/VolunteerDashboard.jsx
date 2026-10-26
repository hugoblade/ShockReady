export default function VolunteerDashboard({ onBack }) {
    return (
        <div style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
            <button onClick={onBack} className="button button-small" style={{ marginBottom: '20px' }}>← Back to Home</button>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ color: 'var(--accent-teal)' }}>Volunteer Dashboard</h1>
                <p style={{ color: 'var(--text-muted)' }}>Your assigned tasks and incident tracking.</p>

                <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-main)', borderRadius: '8px', borderLeft: '4px solid var(--accent-amber)' }}>
                    <h3>Task #1042: Water Leak</h3>
                    <p>Location: Main Street, Ward 4</p>
                    <button className="button button-small">Mark as Resolved</button>
                </div>
            </div>
        </div>
    );
}