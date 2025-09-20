import React, { useState } from 'react';
import { useTheme } from '../utils/ThemeContext';
import PlanGate from '../components/PlanGate/PlanGate';
import TeamMemberList from '../components/TeamManagement/TeamMemberList';
import InviteModal from '../components/TeamManagement/InviteModal';
import RoleManager from '../components/TeamManagement/RoleManager';
import styles from './TeamPage.module.css';

function TeamsPage() {
  const { theme } = useTheme();
  return (
    <PlanGate 
      requiredPlan="professional"
      upgradeMessage="Team Management allows you to collaborate with team members, assign roles, and manage permissions. Available on Professional and Enterprise plans with support for 5+ team members."
      onPaywallClose={() => window.location.href = '/app'}
    >
      <div className={styles.teamPage} style={{ minHeight: '100vh', padding: '32px 0' }}>
        <header className={styles.header}>
          <h1 className={styles.title}>Team Management</h1>
          <p className={styles.subtitle}>Collaborate with your team on automation projects</p>
        </header>
        <div className={styles.content}>
          <TeamManagement />
        </div>
      </div>
    </PlanGate>
  );
}


// ...existing code...
// --- TeamManagement component ---
import { useEffect } from 'react';
const roleOptions = ['Owner', 'Admin', 'Member'];

function TeamManagement() {
  const [members, setMembers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch team members from backend
  useEffect(() => {
    setLoading(true);
    fetch('/api/team')
      .then(res => res.json())
      .then(data => {
        setMembers(data.members || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load team members.');
        setLoading(false);
      });
  }, []);

  // Remove member
  const handleRemove = async (id) => {
    setLoading(true);
    try {
      await fetch(`/api/team/${id}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError('Failed to remove member.');
    }
    setLoading(false);
  };

  // Change role
  const handleRoleChange = async (id, newRole) => {
    setLoading(true);
    try {
      await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRole } : m));
    } catch {
      setError('Failed to update role.');
    }
    setLoading(false);
  };

  // Invite member
  const handleInvite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (data.member) {
        setMembers((prev) => [...prev, data.member]);
      }
      setInviteEmail('');
      setInviteRole('Member');
      setShowInvite(false);
    } catch {
      setError('Failed to invite member.');
    }
    setLoading(false);
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.headerRow} style={{ display: 'flex', fontWeight: 700, borderBottom: '1px solid #ccc', padding: '16px 24px', background: '#f9f9f9' }}>
          <span style={{ flex: 2 }}>Name</span>
          <span style={{ flex: 3 }}>Email</span>
          <span style={{ flex: 2 }}>Role</span>
          <span style={{ flex: 1 }}></span>
        </div>
        {loading && <div style={{ padding: 24 }}>Loading...</div>}
        {error && <div style={{ color: 'red', padding: 12 }}>{error}</div>}
        {!loading && members.length === 0 && !error && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#666' }}>No team members yet.</div>
        )}
        {members.map((member) => (
          <div className={styles.memberRow} key={member.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', padding: '16px 24px' }}>
            <span style={{ flex: 2 }}>{member.name}</span>
            <span style={{ flex: 3 }}>{member.email}</span>
            <span style={{ flex: 2 }}>
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                style={{ padding: 6, borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#222' }}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </span>
            <span style={{ flex: 1, textAlign: 'right' }}>
              <button style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleRemove(member.id)} disabled={loading}>
                Remove
              </button>
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 32, textAlign: 'right' }}>
        <button style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer', margin: '0 8px' }} onClick={() => setShowInvite(true)} disabled={loading}>
          Invite Member
        </button>
      </div>
      {showInvite && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ background: '#fff', color: '#222', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: 32, minWidth: 320 }}>
            <h2 style={{ marginBottom: 16 }}>Invite New Member</h2>
            <input
              style={{ width: '100%', marginBottom: 16, padding: 10, borderRadius: 8, border: '1px solid #ccc', background: '#f9f9f9', color: '#222' }}
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoFocus
            />
            <select
              style={{ width: '100%', marginBottom: 24, padding: 10, borderRadius: 8, border: '1px solid #ccc', background: '#f9f9f9', color: '#222' }}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }} onClick={handleInvite} disabled={loading}>Send Invite</button>
              <button style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowInvite(false)} disabled={loading}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
        </div>
      </div>
    </PlanGate>
  );
}

export default TeamsPage;
