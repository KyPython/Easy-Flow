import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/ThemeContext';
import RoleManager from './RoleManager';
import InviteModal from './InviteModal';
import { FiUserPlus, FiUsers, FiSettings } from 'react-icons/fi';
import styles from './TeamManagement.module.css';

export default function TeamManagement() {
 const { theme } = useTheme();
 const [teamMembers, setTeamMembers] = useState([
 // Mock data for demonstration
 {
 id: '1',
 name: 'John Doe',
 email: 'john@example.com',
 role: 'admin',
 joinedAt: '2024-01-15T10:00:00Z',
 lastActiveAt: '2024-11-04T08:30:00Z',
 avatar: null
 },
 {
 id: '2', 
 name: 'Jane Smith',
 email: 'jane@example.com',
 role: 'editor',
 joinedAt: '2024-02-20T14:30:00Z',
 lastActiveAt: '2024-11-03T16:45:00Z',
 avatar: null
 }
 ]);
 
 const [showInviteModal, setShowInviteModal] = useState(false);
 const [loading, setLoading] = useState(false);
 const currentUserId = '1'; // Mock current user

 const handleInvite = async (inviteData) => {
 setLoading(true);
 try {
 // Mock API call - replace with actual API integration
 console.log('Sending invite:', inviteData);
 
 // Simulate API delay
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 // For demo, just log the invite
 alert(`Invite sent to: ${inviteData.bulk ? inviteData.emails.join(', ') : inviteData.email}`);
 
 } catch (error) {
 throw new Error('Failed to send invite: ' + error.message);
 } finally {
 setLoading(false);
 }
 };

 const handleUpdateRole = async (memberId, newRole) => {
 try {
 // Mock API call - replace with actual API integration
 console.log('Updating role:', memberId, newRole);
 
 setTeamMembers(prev => prev.map(member => 
 member.id === memberId ? { ...member, role: newRole } : member
 ));
 
 alert(`Role updated to: ${newRole}`);
 } catch (error) {
 console.error('Failed to update role:', error);
 alert('Failed to update role');
 }
 };

 const handleRemoveMember = async (memberId) => {
 try {
 // Mock API call - replace with actual API integration
 console.log('Removing member:', memberId);
 
 setTeamMembers(prev => prev.filter(member => member.id !== memberId));
 
 alert('Member removed successfully');
 } catch (error) {
 console.error('Failed to remove member:', error);
 alert('Failed to remove member');
 }
 };

 return (
 <div className={styles.teamManagement}>
 <div className={styles.header}>
 <div className={styles.headerContent}>
 <FiUsers className={styles.headerIcon} />
 <div>
 <h2 className={styles.title}>Team Management</h2>
 <p className={styles.subtitle}>Manage your team members and their permissions</p>
 </div>
 </div>
 
 <button 
 onClick={() => setShowInviteModal(true)}
 className={styles.inviteButton}
 >
 <FiUserPlus />
 Invite Members
 </button>
 </div>

 <RoleManager
 teamMembers={teamMembers}
 currentUserId={currentUserId}
 onUpdateRole={handleUpdateRole}
 onRemoveMember={handleRemoveMember}
 isLoading={loading}
 />

 {showInviteModal && (
 <InviteModal
 isOpen={showInviteModal}
 onClose={() => setShowInviteModal(false)}
 onInvite={handleInvite}
 isLoading={loading}
 />
 )}
 </div>
 );
}
