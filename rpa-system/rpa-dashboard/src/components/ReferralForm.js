import React, { useState } from 'react';
import styles from '../pages/SettingsPage.module.css';
import PropTypes from 'prop-types';
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
        border: '1px solid var(--border-color)',
        padding: '1em',
        borderRadius: 8,
        background: 'var(--surface)',
        color: 'var(--text-primary)',
      }}
      onSubmit={handleSubmit}
    >
      <label className={styles.label} htmlFor="referral-email">
        Enter your friend&apos;s email to refer them:
      </label>
      <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.97em', margin: '2px 0 8px 2px' }}>
        <b>What is this?</b> Type your friend’s email address. We’ll send them an invite to try EasyFlow. Example: <code>friend@email.com</code>
      </div>
      <input
        id="referral-email"
        className={styles.input}
        type="email"
        placeholder="friend@email.com"
        value={referredEmail}
        onChange={e => setReferredEmail(e.target.value)}
        required
        disabled={loading}
        title="Type your friend’s email address here."
        style={{
          marginBottom: '0.5em',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        }}
      />
      <div
        className={styles.muted}
        style={{
          marginBottom: '0.5em',
          color: 'var(--text-muted)',
        }}
      >
  If your friend signs up, you&apos;ll get <strong>1 month free</strong> of the <strong>{proPlan?.name || 'Pro'}</strong> plan!
      </div>
      <div style={{ display: 'flex', gap: '1em' }}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--color-primary-600)',
            color: 'var(--on-primary)',
            border: '1px solid var(--color-primary-600)',
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
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

ReferralForm.propTypes = {
  referrerEmail: PropTypes.string,
  proPlan: PropTypes.object,
  onClose: PropTypes.func,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

ReferralForm.defaultProps = {
  referrerEmail: '',
  proPlan: null,
  onClose: () => {},
  onSuccess: () => {},
  onError: () => {},
};