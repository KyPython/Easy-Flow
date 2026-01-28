import React, { useEffect, useState } from 'react';
import { useTheme } from '../../utils/ThemeContext';
import styles from './SessionExpired.module.css';

export default function SessionExpired() {
 const { theme } = useTheme();
 const [open, setOpen] = useState(false);
 const [count, setCount] = useState(8);
 const [message, setMessage] = useState('Your session has expired. Redirecting to sign-in...');

 useEffect(() => {
 const handler = (e) => {
 const detail = e?.detail || {};
 setMessage(detail.message || 'Your session has expired. Redirecting to sign-in...');
 setOpen(true);
 setCount(detail.countdown || 8);
 // mark as not yet handled until component handles it
 window.__easyflowSessionHandled = false;
 };

 window.addEventListener('easyflow:session-expired', handler);
 return () => window.removeEventListener('easyflow:session-expired', handler);
 }, []);

 useEffect(() => {
 if (!open) return undefined;
 const tick = setInterval(() => {
 setCount((c) => {
 if (c <= 1) {
 clearInterval(tick);
 // mark handled and redirect
 window.__easyflowSessionHandled = true;
 window.location.replace('/auth');
 return 0;
 }
 return c - 1;
 });
 }, 1000);
 return () => clearInterval(tick);
 }, [open]);

 if (!open) return null;

 return (
 <div className={styles.overlay} aria-live="polite">
 <div className={styles.container} data-theme={theme} role="dialog" aria-modal="true">
 <div className={styles.message}>
 <div style={{ fontWeight: 600, marginBottom: 6 }}>Session expired</div>
 <div>{message}</div>
 <div className={styles.countdown} style={{ marginTop: 8 }}>Redirecting in {count}s</div>
 </div>
 <div className={styles.actions}>
 <button
 className={`${styles.btn} ${styles.primary}`}
 onClick={() => { window.__easyflowSessionHandled = true; window.location.replace('/auth'); }}
 >
 Sign in now
 </button>
 <button
 className={`${styles.btn} ${styles.secondary}`}
 onClick={() => { window.__easyflowSessionHandled = true; setOpen(false); }}
 >
 Dismiss
 </button>
 </div>
 </div>
 </div>
 );
}
