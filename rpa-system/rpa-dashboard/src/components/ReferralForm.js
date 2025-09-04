import React, { useState } from 'react';
import styles from '../pages/SettingsPage.module.css';
import { generateReferral } from '../utils/api';
import { useTheme } from '../utils/ThemeContext'; // Add this import

export default function ReferralForm({ referrerEmail, proPlan, onClose, onSuccess, onError }) {
  const [referredEmail, setReferredEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme(); // Get theme from context

  async function handleSubmit(e) {
    e.preventDefault();
    onError('');
    if (!referredEmail || !/\S+@\S+\.\S+/.test(referredEmail)) {
      onError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await generateReferral(referrerEmail, referredEmail);
      onSuccess();
    } catch (err) {
      onError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className={`${styles.formRow} ${theme === 'dark' ? styles.dark : ''}`}
      style={{
        marginTop: '1em',
        border: theme === 'dark' ? '1px solid #4a5568' : '1px solid #eee',
        padding: '1em',
        borderRadius: 8,
        background: theme === 'dark' ? '#2d3748' : '#fafbfc',
        color: theme === 'dark' ? '#f7fafc' : undefined,
      }}
      onSubmit={handleSubmit}
    >
      <label className={styles.label} htmlFor="referral-email">
        Enter your friend's email to refer them:
      </label>
      <input
        id="referral-email"
        className={styles.input}
        type="email"
        placeholder="friend@email.com"
        value={referredEmail}
        onChange={e => setReferredEmail(e.target.value)}
        required
        disabled={loading}
        style={{
          marginBottom: '0.5em',
          background: theme === 'dark' ? '#4a5568' : undefined,
          color: theme === 'dark' ? '#f7fafc' : undefined,
          border: theme === 'dark' ? '1px solid #718096' : undefined,
        }}
      />
      <div
        className={styles.muted}
        style={{
          marginBottom: '0.5em',
          color: theme === 'dark' ? '#a0aec0' : undefined,
        }}
      >
        If your friend signs up, you'll get <strong>1 month free</strong> of the <strong>{proPlan?.name || 'Pro'}</strong> plan!
      </div>
      <div style={{ display: 'flex', gap: '1em' }}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="submit"
          disabled={loading}
          style={{
            background: theme === 'dark' ? '#4a5568' : undefined,
            color: theme === 'dark' ? '#f7fafc' : undefined,
            border: theme === 'dark' ? '1px solid #718096' : undefined,
          }}
        >
          {loading ? 'Sending...' : 'Send Referral'}
        </button>
        <button
          className={`${styles.btn} ${styles.btnAlt}`}
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            background: theme === 'dark' ? '#2d3748' : undefined,
            color: theme === 'dark' ? '#f7fafc' : undefined,
            border: theme === 'dark' ? '1px solid #718096' : undefined,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}