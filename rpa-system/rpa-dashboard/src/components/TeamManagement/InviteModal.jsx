import React, { useState } from 'react';
import { FiX, FiMail, FiUserPlus } from 'react-icons/fi';
import PropTypes from 'prop-types';
import styles from './InviteModal.module.css';

// Lightweight InviteModal (simplified to avoid parser issues)
const InviteModal = ({ isOpen, onClose, onInvite, availableRoles = [], isLoading = false }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(availableRoles?.[0]?.id || 'member');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email) return setError('Email is required');
    try {
      await onInvite({ email, role, message, bulk: false });
      setEmail(''); setMessage('');
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to send invite');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}><FiUserPlus /> Invite Team Member</div>
          <button className={styles.close} onClick={onClose}><FiX /></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@company.com" />
          </label>

          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {availableRoles && availableRoles.length > 0 ? (
                availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
              ) : (
                <option value="member">Member</option>
              )}
            </select>
          </label>

          <label>
            Message (optional)
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={isLoading}>{isLoading ? 'Sending...' : 'Send Invite'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

InviteModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onInvite: PropTypes.func,
  availableRoles: PropTypes.array,
  isLoading: PropTypes.bool,
};

export default InviteModal;
