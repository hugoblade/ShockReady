export default function SysAdminDashboard({ onBack }) {
    return (
        <div style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
            <button onClick={onBack} className="button button-small" style={{ marginBottom: '20px' }}>← Back to Home</button>
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ color: 'var(--accent-teal)' }}>System Admin Dashboard</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage platform access and approve registered organizations.</p>

                <h3 style={{ marginTop: '30px' }}>Pending Organization Approvals</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>Organization Name</th>
                            <th style={{ padding: '10px' }}>Type</th>
                            <th style={{ padding: '10px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px' }}>Lusaka City Council</td>
                            <td style={{ padding: '10px' }}>Municipality</td>
                            <td style={{ padding: '10px' }}>
                                <button className="button button-small" style={{ background: 'var(--accent-sage)' }}>Approve</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}