import React from 'react';
import styles from './ContactModal.module.css';
import PropTypes from 'prop-types';
import { useTheme } from '../../utils/ThemeContext'; // adjust path if needed
import { useI18n } from '../../i18n';

export default function ContactModal({ open, onClose }) {
 const { theme } = useTheme(); // get theme from context
 const { t } = useI18n();
 if (!open) return null;
 return (
 <div className={styles.backdrop} onClick={onClose}>
 <div
 className={`${styles.modal} ${theme === 'dark' ? styles.dark : ''}`}
 onClick={(e) => e.stopPropagation()}
 >
 <h3>{t('contact.title','Contact Support')}</h3>
 <p>{t('contact.intro','If you need help please call or email:')}</p>
 <p>
 {t('contact.phone_label','Phone:')} <a href="tel:+12034494970">+1 (203) 449-4970</a>
 </p>
 <p>
 {t('contact.email_label','Email:')} <a href="mailto:support@useeasyflow.com">support@useeasyflow.com</a>
 </p>
 <div className={styles.actions}>
 <button onClick={onClose}>{t('action.close','Close')}</button>
 </div>
 </div>
 </div>
 );
}

ContactModal.propTypes = {
 open: PropTypes.bool.isRequired,
 onClose: PropTypes.func.isRequired,
};