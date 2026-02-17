import React, { useState, useMemo } from 'react';
import { FiUsers, FiTrash2, FiMoreHorizontal } from 'react-icons/fi';
import { useTheme } from '../../utils/ThemeContext';
import PropTypes from 'prop-types';

// Simplified RoleManager to avoid parsing issues
const RoleManager = React.memo(({
	teamMembers = [],
	availableRoles = [],
	currentUserId,
	onUpdateRole = () => {},
	onRemoveMember = () => {},
	isLoading = false
}) => {
	const { theme } = useTheme();
	const [selectedMembers, setSelectedMembers] = useState(new Set());
	const [filterRole, setFilterRole] = useState('all');

	const defaultRoles = [
		{ id: 'admin', name: 'Admin', description: 'Full access', color: '#dc2626' },
		{ id: 'editor', name: 'Editor', description: 'Can edit', color: '#3b82f6' },
		{ id: 'viewer', name: 'Viewer', description: 'Read only', color: '#059669' },
		{ id: 'member', name: 'Member', description: 'Standard member', color: '#6b7280' }
	];

	const roles = availableRoles && availableRoles.length ? availableRoles : defaultRoles;

	const filteredMembers = useMemo(() => {
		let list = Array.isArray(teamMembers) ? [...teamMembers] : [];
		if (filterRole !== 'all') list = list.filter(m => m.role === filterRole);
		list.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
		return list;
	}, [teamMembers, filterRole]);

	const toggleSelect = (id) => {
		const s = new Set(selectedMembers);
		if (s.has(id)) s.delete(id); else s.add(id);
		setSelectedMembers(s);
	};

	const selectAll = () => {
		if (selectedMembers.size === filteredMembers.length) setSelectedMembers(new Set());
		else setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
	};

	const bulkRemove = () => {
		if (!window.confirm(`Remove ${selectedMembers.size} members?`)) return;
		Array.from(selectedMembers).forEach(id => onRemoveMember(id));
		setSelectedMembers(new Set());
	};

	return (
		<div className="role-manager">
			<div className="manager-header">
				<h2>Team Members</h2>
				<p>{(teamMembers || []).length} total members</p>
			</div>

			<div className="manager-controls">
				<select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
					<option value="all">All Roles</option>
					{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
				</select>
				<button onClick={selectAll}>{selectedMembers.size === filteredMembers.length ? 'Unselect All' : 'Select All'}</button>
				{selectedMembers.size > 0 && <button onClick={bulkRemove}><FiTrash2 /> Remove</button>}
			</div>

			<div className="members-table">
				{isLoading ? (
					<div className="loading">Loading...</div>
				) : filteredMembers.length === 0 ? (
					<div className="empty"><FiUsers /> No team members</div>
				) : (
					filteredMembers.map(member => (
						<div key={member.id} className="member-row">
							<input type="checkbox" checked={selectedMembers.has(member.id)} onChange={() => toggleSelect(member.id)} />
							<div className="member-name">{member.name || member.email}</div>
							<div className="member-role">{member.role || '—'}</div>
							<div className="member-actions">
								{member.id !== currentUserId && (
									<button onClick={() => onRemoveMember(member.id)} title="Remove"><FiMoreHorizontal /></button>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
});

RoleManager.propTypes = {
	teamMembers: PropTypes.array,
	availableRoles: PropTypes.array,
	currentUserId: PropTypes.string,
	onUpdateRole: PropTypes.func,
	onRemoveMember: PropTypes.func,
	isLoading: PropTypes.bool
};

export default RoleManager;
