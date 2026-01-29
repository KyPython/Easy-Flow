import React from 'react';
import './App.css';

/**
 * Ultra-minimal EasyFlow App for testing - no complex dependencies
 */
function App() {
  const [currentPage, setCurrentPage] = React.useState('dashboard');

  return (
    <div className="App">
    <div style={{ 
    fontFamily: 'Arial, sans-serif',
    backgroundColor: 'var(--color-gray-50)',
    minHeight: '100vh',
    display: 'flex'
    }}>
    {/* Simple Navigation */}
    <nav style={{
    width: '250px',
    backgroundColor: 'var(--color-primary-800)',
    color: 'white',
    padding: '20px',
    boxShadow: '2px 0 4px rgba(0,0,0,0.1)'
    }}>
    <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '30px' }}>
    🚀 EasyFlow
    </div>
    
    {['dashboard', 'teams', 'analytics', 'schedules'].map(page => (
    <div
    key={page}
    onClick={() => setCurrentPage(page)}
    style={{
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: currentPage === page ? 'var(--color-primary-500)' : 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    textTransform: 'capitalize'
    }}
    >
    📊 {page}
    </div>
    ))}
    </nav>

    {/* Main Content */}
    <main style={{ flex: 1, padding: '40px' }}>
    <div style={{
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
    <h1 style={{ color: 'var(--color-primary-800)', marginBottom: '20px' }}>
    {currentPage === 'dashboard' && '📊 Dashboard'}
    {currentPage === 'teams' && '👥 Team Management'}
    {currentPage === 'analytics' && '📈 Analytics & Reports'}
    {currentPage === 'schedules' && '⏰ Workflow Schedules'}
    </h1>

    {/* Page Content */}
    {currentPage === 'dashboard' && (
    <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
    {[
    { title: 'Active Workflows', value: '12', color: 'var(--color-success-500)' },
    { title: 'Team Members', value: '8', color: 'var(--color-primary-500)' },
    { title: 'Completed Tasks', value: '245', color: '#8b5cf6' }
    ].map(stat => (
    <div key={stat.title} style={{
    padding: '20px',
    backgroundColor: 'var(--color-gray-50)',
    borderRadius: '8px',
    textAlign: 'center'
    }}>
    <div style={{ fontSize: '32px', fontWeight: 'bold', color: stat.color }}>
    {stat.value}
    </div>
    <div style={{ color: 'var(--color-gray-500)', marginTop: '8px' }}>
    {stat.title}
    </div>
    </div>
    ))}
    </div>
    <p>✅ EasyFlow automation platform is running successfully!</p>
    </div>
    )}

    {currentPage === 'teams' && (
    <div>
    <h3>Team Management</h3>
    <div style={{ marginTop: '20px' }}>
    {[
    { name: 'Alice Johnson', role: 'Admin', status: 'Active' },
    { name: 'Bob Smith', role: 'Developer', status: 'Active' },
    { name: 'Carol Davis', role: 'Analyst', status: 'Inactive' }
    ].map(member => (
    <div key={member.name} style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '15px',
    backgroundColor: 'var(--color-gray-50)',
    marginBottom: '10px',
    borderRadius: '6px'
    }}>
    <span>{member.name}</span>
    <span style={{ color: 'var(--color-gray-500)' }}>{member.role}</span>
    <span style={{ 
    color: member.status === 'Active' ? 'var(--color-success-500)' : 'var(--color-error-500)',
    fontWeight: 'bold'
    }}>
    {member.status}
    </span>
    </div>
    ))}
    </div>
    </div>
    )}

    {currentPage === 'analytics' && (
    <div>
    <h3>Analytics & Reports</h3>
    <div style={{ marginTop: '20px' }}>
    <p>📊 Analytics component loaded successfully!</p>
    <div style={{ padding: '20px', backgroundColor: 'var(--color-primary-50)', borderRadius: '8px', marginTop: '15px' }}>
    <h4>Quick Actions:</h4>
    <button style={{ margin: '5px', padding: '8px 16px', backgroundColor: 'var(--color-primary-500)', color: 'white', border: 'none', borderRadius: '4px' }}>
    Generate Report
    </button>
    <button style={{ margin: '5px', padding: '8px 16px', backgroundColor: 'var(--color-success-500)', color: 'white', border: 'none', borderRadius: '4px' }}>
    Export Data
    </button>
    </div>
    </div>
    </div>
    )}

    {currentPage === 'schedules' && (
    <div>
    <h3>Workflow Schedules</h3>
    <div style={{ marginTop: '20px' }}>
    <p>⏰ Schedule builder ready for configuration!</p>
    <div style={{ padding: '20px', backgroundColor: 'var(--color-warning-50)', borderRadius: '8px', marginTop: '15px' }}>
    <h4>Scheduled Tasks:</h4>
    <ul>
    <li>Daily backup - 2:00 AM</li>
    <li>Weekly reports - Monday 9:00 AM</li>
    <li>Data sync - Every 4 hours</li>
    </ul>
    </div>
    </div>
    </div>
    )}
    </div>
    </main>
    </div>
    </div>
  );
}

export default App;
