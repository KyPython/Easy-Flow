import React, { useState, useMemo } from 'react';
import { FiUsers, FiEdit3, FiTrash2, FiShield, FiMoreHorizontal, FiUserCheck } from 'react-icons/fi';
import { useTheme } from '../../utils/ThemeContext';
import PropTypes from 'prop-types';
import styles from './RoleManager.module.css';

/**
 * RoleManager - Team role and permission management component
 * Features: View team members, assign roles, manage permissions, bulk operations
 */
const RoleManager = React.memo(({ 
 teamMembers = [], 
 availableRoles = [],
 currentUserId,
 onUpdateRole,
 onRemoveMember,
 onUpdatePermissions,
 isLoading = false 
}) => {
 const { theme } = useTheme();
 const [selectedMembers, setSelectedMembers] = useState(new Set());
 const [filterRole, setFilterRole] = useState('all');
 const [sortBy, setSortBy] = useState('name'); // name, role, joinDate, lastActive
 const [editingMember, setEditingMember] = useState(null);

 const defaultRoles = [
 { 
 id: 'admin', 
 name: 'Admin', 
 description: 'Full access to all features and settings',
 permissions: ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
 color: '#dc2626'
 },
 { 
 id: 'editor', 
 name: 'Editor', 
 description: 'Can create and modify workflows',
 permissions: ['read', 'write'],
 color: '#3b82f6'
 },
 { 
 id: 'viewer', 
 name: 'Viewer', 
 description: 'Can view workflows and results',
 permissions: ['read'],
 color: '#059669'
 },
 { 
 id: 'member', 
 name: 'Member', 
 description: 'Standard team member access',
 permissions: ['read', 'write'],
 color: '#6b7280'
 }
 ];

 const roles = availableRoles.length > 0 ? availableRoles : defaultRoles;

 // Filtered and sorted team members
 const filteredMembers = useMemo(() => {
 let filtered = [...teamMembers];

 // Apply role filter
 if (filterRole !== 'all') {
 filtered = filtered.filter(member => member.role === filterRole);
 }

 // Apply sorting
 filtered.sort((a, b) => {
 switch (sortBy) {
 case 'name':
 return (a.name || a.email).localeCompare(b.name || b.email);
 case 'role':
 return (a.role || '').localeCompare(b.role || '');
 case 'joinDate':
 return new Date(b.joinedAt) - new Date(a.joinedAt);
 case 'lastActive':
 return new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0);
 default:
 return 0;
 }
 });

 return filtered;
 }, [teamMembers, filterRole, sortBy]);

 const roleStats = useMemo(() => {
 const stats = {};
 roles.forEach(role => {
 stats[role.id] = teamMembers.filter(member => member.role === role.id).length;
 });
 return stats;
 }, [teamMembers, roles]);

 const handleSelectMember = (memberId) => {
 const newSelected = new Set(selectedMembers);
 if (newSelected.has(memberId)) {
 newSelected.delete(memberId);
 } else {
 newSelected.add(memberId);
 }
 setSelectedMembers(newSelected);
 };

 const handleSelectAll = () => {
 if (selectedMembers.size === filteredMembers.length) {
 setSelectedMembers(new Set());
 } else {
 setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
 }
 };

 const handleBulkRoleChange = async (newRole) => {
 const memberIds = Array.from(selectedMembers);
 try {
 await Promise.all(
 memberIds.map(id => onUpdateRole(id, newRole))
 );
 setSelectedMembers(new Set());
 } catch (error) {
 console.error('Bulk role update failed:', error);
 }
 };

 const handleBulkRemove = async () => {
 if (window.confirm(`Remove ${selectedMembers.size} selected members?`)) {
 const memberIds = Array.from(selectedMembers);
 try {
 await Promise.all(
 memberIds.map(id => onRemoveMember(id))
 );
 setSelectedMembers(new Set());
 } catch (error) {
 console.error('Bulk remove failed:', error);
 }
 }
 };

 const getRoleInfo = (roleId) => {
 return roles.find(role => role.id === roleId) || roles[0];
 };

 const formatLastActive = (dateString) => {
 if (!dateString) return 'Never';
 const date = new Date(dateString);
 const now = new Date();
 const diffHours = (now - date) / (1000 * 60 * 60);
 
 if (diffHours < 1) return 'Just now';
 if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
 if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
 return date.toLocaleDateString();
 };

 return (
 <div className="role-manager">
 <div className="manager-header">
 <div className="header-left">
 <h2>Team Members</h2>
 <p className="member-count">{teamMembers.length} total members</p>
 </div>
 
 <div className="role-stats">
 {roles.map(role => (
 <div key={role.id} className="role-stat">
 <div 
 className="role-badge"
 style={{ backgroundColor: role.color }}
 >
 {roleStats[role.id] || 0}
 </div>
 <span className="role-label">{role.name}</span>
 </div>
 ))}
 </div>
 </div>

 <div className="manager-controls">
 <div className="filters">
 <select
 value={filterRole}
 onChange={(e) => setFilterRole(e.target.value)}
 className="filter-select"
 >
 <option value="all">All Roles ({teamMembers.length})</option>
 {roles.map(role => (
 <option key={role.id} value={role.id}>
 {role.name} ({roleStats[role.id] || 0})
 </option>
 ))}
 </select>

 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value)}
 className="sort-select"
 >
 <option value="name">Sort by Name</option>
 <option value="role">Sort by Role</option>
 <option value="joinDate">Sort by Join Date</option>
 <option value="lastActive">Sort by Last Active</option>
 </select>
 </div>

 {selectedMembers.size > 0 && (
 <div className="bulk-actions">
 <span className="selected-count">
 {selectedMembers.size} selected
 </span>
 
 <select
 onChange={(e) => {
 if (e.target.value) {
 handleBulkRoleChange(e.target.value);
 e.target.value = '';
 }
 }}
 className="bulk-role-select"
 >
 <option value="">Change Role...</option>
 {roles.map(role => (
 <option key={role.id} value={role.id}>
 {role.name}
 </option>
 ))}
 </select>
 
 <button
 onClick={handleBulkRemove}
 className="bulk-btn bulk-btn-danger"
 >
 <FiTrash2 /> Remove
 </button>
 </div>
 )}
 </div>

 {isLoading ? (
 <div className="loading-state">
 <div className="spinner" />
 <p>Loading team members...</p>
 </div>
 ) : filteredMembers.length === 0 ? (
 <div className="empty-state">
 <FiUsers className="empty-icon" />
 <h3>No team members found</h3>
 <p>
 {filterRole === 'all' 
 ? 'No team members have been added yet.'
 : `No members with ${roles.find(r => r.id === filterRole)?.name} role.`
 }
 </p>
 </div>
 ) : (
 <div className="members-table">
 <div className="table-header">
 <div className="header-cell checkbox-cell">
 <input
 type="checkbox"
 checked={selectedMembers.size === filteredMembers.length}
 onChange={handleSelectAll}
 />
 </div>
 <div className="header-cell">Member</div>
 <div className="header-cell">Role</div>
 <div className="header-cell">Joined</div>
 <div className="header-cell">Last Active</div>
 <div className="header-cell">Actions</div>
 </div>

 <div className="table-body">
 {filteredMembers.map((member) => (
 <MemberRow
 key={member.id}
 member={member}
 roles={roles}
 isSelected={selectedMembers.has(member.id)}
 isCurrentUser={member.id === currentUserId}
 onSelect={() => handleSelectMember(member.id)}
 onUpdateRole={(roleId) => onUpdateRole(member.id, roleId)}
 onRemove={() => onRemoveMember(member.id)}
 formatLastActive={formatLastActive}
 getRoleInfo={getRoleInfo}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

/**
 * Individual Member Row Component
 */
const MemberRow = React.memo(({ 
 member, 
 roles,
 isSelected, 
 isCurrentUser,
 onSelect, 
 onUpdateRole, 
 onRemove,
 formatLastActive,
 getRoleInfo
}) => {
 const [showActions, setShowActions] = useState(false);
 const [isUpdating, setIsUpdating] = useState(false);
 
 const roleInfo = getRoleInfo(member.role);

 const handleRoleChange = async (newRole) => {
 if (newRole === member.role) return;
 
 setIsUpdating(true);
 try {
 await onUpdateRole(newRole);
 } catch (error) {
 console.error('Role update failed:', error);
 } finally {
 setIsUpdating(false);
 }
 };

 const handleRemove = () => {
 if (window.confirm(`Remove ${member.name || member.email} from the team?`)) {
 onRemove();
 }
 };

 return (
 <div className={`table-row ${isCurrentUser ? 'current-user' : ''}`}>
 <div className="table-cell checkbox-cell">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={onSelect}
 disabled={isCurrentUser}
 />
 </div>
 
 <div className="table-cell">
 <div className="member-info">
 <div className="member-avatar">
 {member.avatar ? (
 <img src={member.avatar} alt={member.name} />
 ) : (
 <span className="avatar-initials">
 {((member.name || member.email).split(' ').map(n => n[0]).join('').slice(0, 2)).toUpperCase()}
 </span>
 )}
 </div>
 <div className="member-details">
 <strong className="member-name">
 {member.name || member.email}
 {isCurrentUser && <span className="you-badge">You</span>}
 </strong>
 <span className="member-email">{member.email}</span>
 </div>
 </div>
 </div>
 
 <div className="table-cell">
 <div className="role-display">
 <span 
 className="role-badge"
 style={{ backgroundColor: roleInfo.color }}
 >
 {roleInfo.name}
 </span>
 <span className="role-description">{roleInfo.description}</span>
 </div>
 </div>
 
 <div className="table-cell">
 {new Date(member.joinedAt).toLocaleDateString()}
 </div>
 
 <div className="table-cell">
 <span className={`activity-status ${member.lastActiveAt && new Date(member.lastActiveAt) > new Date(Date.now() - 24*60*60*1000) ? 'active' : 'inactive'}`}>
 {formatLastActive(member.lastActiveAt)}
 </span>
 </div>
 
 <div className="table-cell actions-cell">
 <div className="member-actions">
 <select
 value={member.role}
 onChange={(e) => handleRoleChange(e.target.value)}
 disabled={isCurrentUser || isUpdating}
 className="role-select"
 >
 {roles.map(role => (
 <option key={role.id} value={role.id}>
 {role.name}
 </option>
 ))}
 </select>
 
 {!isCurrentUser && (
 <div className="actions-dropdown">
 <button
 onClick={() => setShowActions(!showActions)}
 className="actions-trigger"
 >
 <FiMoreHorizontal />
 </button>
 
 {showActions && (
 <div className="actions-menu">
 <button
 onClick={handleRemove}
 className="action-item action-danger"
 >
 <FiTrash2 /> Remove Member
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 );
});

MemberRow.displayName = 'MemberRow';

RoleManager.propTypes = {
 teamMembers: PropTypes.arrayOf(PropTypes.shape({
 id: PropTypes.string.isRequired,
 name: PropTypes.string,
 email: PropTypes.string.isRequired,
 role: PropTypes.string.isRequired,
 avatar: PropTypes.string,
 joinedAt: PropTypes.string.isRequired,
 lastActiveAt: PropTypes.string,
 })),
 availableRoles: PropTypes.arrayOf(PropTypes.shape({
 id: PropTypes.string.isRequired,
 name: PropTypes.string.isRequired,
 description: PropTypes.string.isRequired,
 permissions: PropTypes.arrayOf(PropTypes.string),
 color: PropTypes.string,
 })),
 currentUserId: PropTypes.string,
 onUpdateRole: PropTypes.func.isRequired,
 onRemoveMember: PropTypes.func.isRequired,
 onUpdatePermissions: PropTypes.func,
 isLoading: PropTypes.bool,
};

MemberRow.propTypes = {
 member: PropTypes.object.isRequired,
 roles: PropTypes.array.isRequired,
 isSelected: PropTypes.bool.isRequired,
 isCurrentUser: PropTypes.bool.isRequired,
 onSelect: PropTypes.func.isRequired,
 onUpdateRole: PropTypes.func.isRequired,
 onRemove: PropTypes.func.isRequired,
 formatLastActive: PropTypes.func.isRequired,
 getRoleInfo: PropTypes.func.isRequired,
});

export default RoleManager;
