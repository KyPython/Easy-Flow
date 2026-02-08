/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../utils/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import PlanGate from '../components/PlanGate/PlanGate';
import styles from './TeamPage.module.css';

function TeamsPage() {
 const { theme } = useTheme();
 const navigate = useNavigate();
 
 return (
 <PlanGate 
 requiredPlan="professional"
 upgradeMessage="Team Management allows you to collaborate with team members, assign roles, and manage permissions. Available on Professional and Enterprise plans with support for 5+ team members."
 onPaywallClose={() => {
 console.log('[TeamsPage] Paywall dismissed, navigating back');
 navigate(-1);
 }}
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
import { api } from '../utils/api';

// Helper to get auth token from env or localStorage
function getAuthToken() {
 return process.env.REACT_APP_API_KEY || localStorage.getItem('token');
}
const roleOptions = ['Owner', 'Admin', 'Member'];

// Map display role names to backend role values
const roleMap = {
 'Owner': 'owner',
 'Admin': 'admin',
 'Member': 'member'
};

// Reverse map for displaying backend roles
const roleDisplayMap = {
 'owner': 'Owner',
 'admin': 'Admin',
 'member': 'Member'
};

function TeamManagement() {
 const { user } = useAuth(); // Get current user
 const currentUserId = user?.id;
 
 const [members, setMembers] = useState([]);
 const [invitations, setInvitations] = useState([]);
 const [showInvite, setShowInvite] = useState(false);
 const [inviteName, setInviteName] = useState('');
 const [inviteEmail, setInviteEmail] = useState('');
 const [inviteRole, setInviteRole] = useState('Member');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [successMessage, setSuccessMessage] = useState('');

 // Fetch team members and invitations from backend
 useEffect(() => {
 let cancelled = false;
 const load = async () => {
 // Only show loading spinner on initial load
 if (members.length === 0 && invitations.length === 0) {
 setLoading(true);
 }
 try {
 const [membersRes, invitationsRes] = await Promise.all([
 api.get('/api/team'),
 api.get('/api/team/invitations').catch(() => ({ data: { invitations: [] } }))
 ]);
 if (!cancelled) {
 setMembers(membersRes.data.members || []);
 setInvitations(invitationsRes.data.invitations || []);
 }
 } catch (err) {
 if (!cancelled) setError('Failed to load team data.');
 } finally {
 if (!cancelled) setLoading(false);
 }
 };

 load();
 // Poll for updates every 30 seconds (reduced from 5 seconds for better performance)
 const interval = setInterval(load, 30000);
 return () => { 
 cancelled = true;
 clearInterval(interval);
 };
 }, []);

 // Remove member
 const handleRemove = async (id) => {
 setLoading(true);
 try {
 await api.delete(`/api/team/${id}`);
 setMembers((prev) => prev.filter((m) => m.id !== id));
 } catch (e) {
 setError('Failed to remove member.');
 }
 setLoading(false);
 };

 // Change role
 const handleRoleChange = async (id, newRoleDisplay) => {
 setLoading(true);
 try {
 // Convert display role to backend role
 const backendRole = roleMap[newRoleDisplay] || newRoleDisplay.toLowerCase();
 await api.patch(`/api/team/${id}`, { role: backendRole });
 setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role: newRoleDisplay } : m));
 } catch (e) {
 setError('Failed to update role.');
 }
 setLoading(false);
 };

 // Invite member
 const handleInvite = async () => {
 if (!inviteEmail) {
 setError('Email is required');
 return;
 }
 setLoading(true);
 setError('');
 setSuccessMessage('');
 try {
 // Convert display role to backend role
 const backendRole = roleMap[inviteRole] || inviteRole.toLowerCase();
 const payload = { 
 email: inviteEmail, 
 role: backendRole 
 };
 
 // Include name if provided
 if (inviteName.trim()) {
 payload.name = inviteName.trim();
 }
 
 const { data } = await api.post('/api/team/invite', payload);
 
 // Add invitation to the list
 if (data.invitation) {
 setInvitations((prev) => [data.invitation, ...prev]);
 }
 
 const displayName = inviteName ? `${inviteName} (${inviteEmail})` : inviteEmail;
 setSuccessMessage(data.message || `Invitation sent to ${displayName}! They will receive an email to accept.`);
 setInviteName('');
 setInviteEmail('');
 setInviteRole('Member');
 setShowInvite(false);
 
 // Clear success message after 5 seconds
 setTimeout(() => setSuccessMessage(''), 5000);
 } catch (e) {
 setError(e.response?.data?.error || 'Failed to invite member.');
 }
 setLoading(false);
 };

 // Cancel invitation
 const handleCancelInvite = async (inviteId) => {
 setLoading(true);
 try {
 await api.delete(`/api/team/invitations/${inviteId}`);
 setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId));
 } catch (e) {
 setError('Failed to cancel invitation.');
 }
 setLoading(false);
 };

 return (
 <>
 {successMessage && (
 <div style={{ 
 background: '#d4edda', 
 color: '#155724', 
 padding: '16px 24px', 
 borderRadius: '8px', 
 marginBottom: '24px',
 border: '1px solid #c3e6cb',
 boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 <span style={{ fontSize: '20px' }}>✉️</span>
 <div>
 <div style={{ fontWeight: 700, marginBottom: '4px' }}>Invitation Sent!</div>
 <div>{successMessage}</div>
 <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
 The invitation will appear below as "Pending" until they accept it via email.
 </div>
 </div>
 </div>
 </div>
 )}
 
 <div className={styles.card}>
 <div className={styles.headerRow} style={{ display: 'flex', fontWeight: 700, borderBottom: '1px solid #ccc', padding: '16px 24px', background: '#f9f9f9' }}>
 <span style={{ flex: 2 }}>Name</span>
 <span style={{ flex: 3 }}>Email</span>
 <span style={{ flex: 2 }}>Role</span>
 <span style={{ flex: 1, textAlign: 'center' }}>Status</span>
 <span style={{ flex: 1 }}></span>
 </div>
 {loading && <div style={{ padding: 24 }}>Loading...</div>}
 {error && <div style={{ color: 'red', padding: 12 }}>{error}</div>}
 {!loading && members.length === 0 && invitations.length === 0 && !error && (
 <div style={{ padding: '32px', textAlign: 'center', color: '#666' }}>No team members yet.</div>
 )}
 
 {/* Active Members */}
 {members.map((member) => {
 // Convert backend role to display role
 const displayRole = roleDisplayMap[member.role] || member.role || 'Member';
 const isCurrentUser = member.id === currentUserId;
 
 return (
 <div className={styles.memberRow} key={member.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', padding: '16px 24px' }}>
 <span style={{ flex: 2 }}>
 {member.full_name || member.name || 'N/A'}
 {isCurrentUser && <span style={{ marginLeft: '8px', color: '#007bff', fontSize: '12px', fontWeight: 600 }}>(You)</span>}
 </span>
 <span style={{ flex: 3 }}>{member.email}</span>
 <span style={{ flex: 2 }}>
 {isCurrentUser ? (
 // Show role as text for current user
 <span style={{ padding: '6px 12px', color: '#6c757d', fontWeight: 600 }}>{displayRole}</span>
 ) : (
 // Show dropdown for other users
 <select
 value={displayRole}
 onChange={(e) => handleRoleChange(member.id, e.target.value)}
 style={{ padding: 6, borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#222' }}
 disabled={loading}
 >
 {roleOptions.map((role) => (
 <option key={role} value={role}>{role}</option>
 ))}
 </select>
 )}
 </span>
 <span style={{ flex: 1, textAlign: 'center' }}>
 <span style={{ 
 background: '#28a745', 
 color: '#fff', 
 padding: '4px 12px', 
 borderRadius: '12px', 
 fontSize: '12px',
 fontWeight: 600
 }}>
 Active
 </span>
 </span>
 <span style={{ flex: 1, textAlign: 'right' }}>
 {isCurrentUser ? (
 // Disable remove button for current user
 <button 
 style={{ 
 background: '#ccc', 
 color: '#666', 
 border: 'none', 
 borderRadius: 8, 
 padding: '8px 20px', 
 fontWeight: 600, 
 cursor: 'not-allowed',
 opacity: 0.5
 }} 
 disabled
 title="You cannot remove yourself"
 >
 Remove
 </button>
 ) : (
 <button 
 style={{ 
 background: '#e74c3c', 
 color: '#fff', 
 border: 'none', 
 borderRadius: 8, 
 padding: '8px 20px', 
 fontWeight: 600, 
 cursor: 'pointer' 
 }} 
 onClick={() => handleRemove(member.id)} 
 disabled={loading}
 >
 Remove
 </button>
 )}
 </span>
 </div>
 );
 })}
 
 {/* Pending Invitations */}
 {invitations.map((invite) => {
 const displayRole = roleDisplayMap[invite.role] || invite.role || 'Member';
 const expiresAt = new Date(invite.expires_at);
 const isExpired = expiresAt < new Date();
 const displayName = invite.invitee_name || 'Invited User';
 const timeLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
 
 return (
 <div className={styles.memberRow} key={invite.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', padding: '16px 24px', background: '#fffbf0', borderLeft: '4px solid #ffc107' }}>
 <span style={{ flex: 2, color: '#6c757d' }}>
 <div style={{ fontWeight: 600 }}>{displayName}</div>
 <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
 {isExpired ? 'Expired' : `Expires in ${timeLeft} day${timeLeft !== 1 ? 's' : ''}`}
 </div>
 </span>
 <span style={{ flex: 3 }}>{invite.invitee_email}</span>
 <span style={{ flex: 2 }}>{displayRole}</span>
 <span style={{ flex: 1, textAlign: 'center' }}>
 <span style={{ 
 background: isExpired ? '#dc3545' : '#ffc107', 
 color: isExpired ? '#fff' : '#000', 
 padding: '6px 14px', 
 borderRadius: '16px', 
 fontSize: '12px',
 fontWeight: 700,
 textTransform: 'uppercase',
 letterSpacing: '0.5px'
 }}>
 {isExpired ? '⚠️ Expired' : '⏳ Pending'}
 </span>
 </span>
 <span style={{ flex: 1, textAlign: 'right' }}>
 <button 
 style={{ 
 background: '#6c757d', 
 color: '#fff', 
 border: 'none', 
 borderRadius: 8, 
 padding: '8px 20px', 
 fontWeight: 600, 
 cursor: 'pointer',
 fontSize: '13px'
 }} 
 onClick={() => handleCancelInvite(invite.id)} 
 disabled={loading}
 title="Cancel this invitation"
 >
 Cancel
 </button>
 </span>
 </div>
 );
 })}
 </div>
 <div style={{ marginTop: 32, textAlign: 'right' }}>
 <button style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer', margin: '0 8px' }} onClick={() => setShowInvite(true)} disabled={loading}>
 Invite Member
 </button>
 </div>
 {showInvite && (
 <div className={styles.modalOverlay}>
 <div className={styles.modal} style={{ background: '#fff', color: '#222', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: 32, minWidth: 400 }}>
 <h2 style={{ marginBottom: 24, fontSize: '20px', fontWeight: 700 }}>Invite New Member</h2>
 
 <div style={{ marginBottom: 16 }}>
 <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#555' }}>
 Name <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span>
 </label>
 <input
 style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', background: '#f9f9f9', color: '#222', fontSize: '14px' }}
 type="text"
 placeholder="e.g., John Doe"
 value={inviteName}
 onChange={(e) => setInviteName(e.target.value)}
 autoFocus
 />
 </div>
 
 <div style={{ marginBottom: 16 }}>
 <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#555' }}>
 Email <span style={{ color: '#dc3545' }}>*</span>
 </label>
 <input
 style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', background: '#f9f9f9', color: '#222', fontSize: '14px' }}
 type="email"
 placeholder="email@example.com"
 value={inviteEmail}
 onChange={(e) => setInviteEmail(e.target.value)}
 />
 </div>
 
 <div style={{ marginBottom: 24 }}>
 <label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#555' }}>
 Role
 </label>
 <select
 style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', background: '#f9f9f9', color: '#222', fontSize: '14px' }}
 value={inviteRole}
 onChange={(e) => setInviteRole(e.target.value)}
 >
 {roleOptions.map((role) => (
 <option key={role} value={role}>{role}</option>
 ))}
 </select>
 </div>
 
 {error && (
 <div style={{ 
 background: '#f8d7da', 
 color: '#721c24', 
 padding: '12px', 
 borderRadius: '8px', 
 marginBottom: '16px',
 border: '1px solid #f5c6cb',
 fontSize: '14px'
 }}>
 {error}
 </div>
 )}
 
 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
 <button 
 style={{ 
 background: '#6c757d', 
 color: '#fff', 
 border: 'none', 
 borderRadius: 8, 
 padding: '10px 24px', 
 fontWeight: 600, 
 cursor: 'pointer',
 fontSize: '14px'
 }} 
 onClick={() => {
 setShowInvite(false);
 setInviteName('');
 setInviteEmail('');
 setError('');
 }} 
 disabled={loading}
 >
 Cancel
 </button>
 <button 
 style={{ 
 background: loading ? '#6c757d' : '#007bff', 
 color: '#fff', 
 border: 'none', 
 borderRadius: 8, 
 padding: '10px 24px', 
 fontWeight: 600, 
 cursor: loading ? 'not-allowed' : 'pointer',
 fontSize: '14px'
 }} 
 onClick={handleInvite} 
 disabled={loading}
 >
 {loading ? 'Sending...' : 'Send Invite'}
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
}

export default TeamsPage;
