import React, { useState } from 'react';
import { FiX, FiMail, FiUserPlus, FiCheck } from 'react-icons/fi';
import { useTheme } from '../../utils/ThemeContext';
import PropTypes from 'prop-types';
import styles from './InviteModal.module.css';

/**
 * InviteModal - Team member invitation modal with role selection
 * Features: Email validation, role assignment, bulk invite, integration ready
 */
const InviteModal = React.memo(({ 
  isOpen, 
  onClose, 
  onInvite,
  availableRoles = [],
  isLoading = false 
}) => {
  const { theme } = useTheme();
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'member',
    message: ''
  });
  
  const [errors, setErrors] = useState({});
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');

  const defaultRoles = [
    { id: 'admin', name: 'Admin', description: 'Full access to all features and settings' },
    { id: 'editor', name: 'Editor', description: 'Can create and modify workflows' },
    { id: 'viewer', name: 'Viewer', description: 'Can view workflows and results' },
    { id: 'member', name: 'Member', description: 'Standard team member access' }
  ];

  const roles = availableRoles.length > 0 ? availableRoles : defaultRoles;

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = () => {
    const newErrors = {};

    if (bulkMode) {
      const emails = bulkEmails.split('\n').filter(email => email.trim());
      if (emails.length === 0) {
        newErrors.bulkEmails = 'Please enter at least one email address';
      } else {
        const invalidEmails = emails.filter(email => !validateEmail(email.trim()));
        if (invalidEmails.length > 0) {
          newErrors.bulkEmails = `Invalid email addresses: ${invalidEmails.join(', ')}`;
        }
      }
    } else {
      if (!inviteData.email) {
        newErrors.email = 'Email address is required';
      } else if (!validateEmail(inviteData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (!inviteData.role) {
      newErrors.role = 'Please select a role';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (bulkMode) {
        const emails = bulkEmails.split('\n')
          .map(email => email.trim())
          .filter(email => email);
        
        await onInvite({
          emails,
          role: inviteData.role,
          message: inviteData.message,
          bulk: true
        });
      } else {
        await onInvite({
          email: inviteData.email,
          role: inviteData.role,
          message: inviteData.message,
          bulk: false
        });
      }

      // Reset form
      setInviteData({ email: '', role: 'member', message: '' });
      setBulkEmails('');
      setErrors({});
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to send invitation' });
    }
  };

  const handleInputChange = (field, value) => {
    setInviteData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const selectedRole = roles.find(role => role.id === inviteData.role);

  if (!isOpen) return null;

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <div className="header-icon">
              <FiUserPlus />
            </div>
            <div>
              <h2>Invite Team Members</h2>
              <p>Send invitations to new team members</p>
            </div>
          </div>
          
          <button onClick={onClose} className="close-button">
            <FiX />
          </button>
        </div>

        <div className="modal-content">
          <div className="invite-mode-selector">
            <button
              className={`mode-btn ${!bulkMode ? 'active' : ''}`}
              onClick={() => setBulkMode(false)}
            >
              Single Invite
            </button>
            <button
              className={`mode-btn ${bulkMode ? 'active' : ''}`}
              onClick={() => setBulkMode(true)}
            >
              Bulk Invite
            </button>
          </div>

          <form onSubmit={handleSubmit} className="invite-form">
            {!bulkMode ? (
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-with-icon">
                  <FiMail className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="colleague@company.com"
                    className={errors.email ? 'error' : ''}
                  />
                </div>
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="bulkEmails">Email Addresses (one per line)</label>
                <textarea
                  id="bulkEmails"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  placeholder="user1@company.com&#10;user2@company.com&#10;user3@company.com"
                  rows={6}
                  className={errors.bulkEmails ? 'error' : ''}
                />
                {errors.bulkEmails && <span className="error-text">{errors.bulkEmails}</span>}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="role">Role Assignment</label>
              <select
                id="role"
                value={inviteData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className={errors.role ? 'error' : ''}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              
              {selectedRole && (
                <div className="role-description">
                  <FiCheck className="check-icon" />
                  <span>{selectedRole.description}</span>
                </div>
              )}
              
              {errors.role && <span className="error-text">{errors.role}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="message">Personal Message (Optional)</label>
              <textarea
                id="message"
                value={inviteData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                placeholder="Welcome to our team! Looking forward to working with you."
                rows={3}
              />
              <small>This message will be included in the invitation email</small>
            </div>

            {errors.submit && (
              <div className="error-banner">
                <span>{errors.submit}</span>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" />
                    Sending...
                  </>
                ) : (
                  <>
                    <FiMail />
                    {bulkMode ? 'Send Invitations' : 'Send Invitation'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            <p>
              <strong>Note:</strong> Invited members will receive an email with setup instructions 
              and a secure link to join your team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

InviteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onInvite: PropTypes.func.isRequired,
  availableRoles: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
  })),
  isLoading: PropTypes.bool,
});

export default InviteModal;
