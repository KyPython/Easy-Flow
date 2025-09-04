import React from 'react';
import styles from './ContactModal.module.css';
import PropTypes from 'prop-types';
import { useTheme } from '../../utils/ThemeContext'; // adjust path if needed

export default function ContactModal({ open, onClose }) {
  const { theme } = useTheme(); // get theme from context
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.modal} ${theme === 'dark' ? styles.dark : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Contact Support</h3>
        <p>If you need help please call or email:</p>
        <p>
          Phone: <a href="tel:+12034494970">+1 (203) 449-4970</a>
        </p>
        <p>
          Email: <a href="mailto:kyjahntsmith@gmail.com">kyjahntsmith@gmail.com</a>
        </p>
        <div className={styles.actions}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

ContactModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};