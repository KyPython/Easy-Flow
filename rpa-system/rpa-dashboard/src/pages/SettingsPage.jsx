import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { generateReferral } from '../utils/api';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState('free');
  const [referralUrl, setReferralUrl] = useState('');

  useEffect(() => {
    // load profile info (plan) if you have a profiles table
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
        if (error && error.code !== 'PGRST116') {
          // ignore not found; otherwise log
          console.warn('profiles load error', error);
        }
        if (mounted && data?.plan) setPlan(data.plan);
      } catch (e) {
        console.warn(e);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  async function updatePassword(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setMessage(`Failed: ${error.message}`);
      else setMessage('Password updated successfully.');
    } catch (err) {
      setMessage('Unexpected error');
    }
    setLoading(false);
  }

  async function changePlan(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      // upsert user's plan to profiles table
      const payload = { id: user.id, plan };
      const { error } = await supabase.from('profiles').upsert(payload);
      if (error) setMessage(`Plan update failed: ${error.message}`);
      else setMessage('Plan updated.');
    } catch (err) {
      setMessage('Unexpected error');
    }
    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Settings</h2>
      <section className={styles.section}>
        <h3 className={styles.heading}>Theme</h3>
        <p className={styles.muted}>Current: {theme}</p>
        <div className={styles.formRow}>
          <button className={`${styles.btn} ${styles.btnAlt}`} onClick={toggle}>{theme === 'light' ? 'Switch to dark' : 'Switch to light'}</button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Referrals</h3>
        <p className={styles.muted}>Share EasyFlow and get credit for new signups.</p>
        <div className={styles.formRow}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={async () => {
            setMessage('');
            try {
              const resp = await generateReferral();
              if (resp && resp.ok) {
                setReferralUrl(resp.url || '');
                setMessage('Referral generated.');
              } else {
                setMessage('Failed to generate referral.');
              }
            } catch (e) {
              setMessage('Unexpected error generating referral');
            }
          }}>Generate referral</button>
        </div>
        {referralUrl && (<div style={{ marginTop: 12 }}><a href={referralUrl} target="_blank" rel="noreferrer">{referralUrl}</a></div>)}
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Change password</h3>
        <form onSubmit={updatePassword} className={styles.formRow}>
          <input className={styles.input} placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} type="password" />
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={loading}>Update password</button>
        </form>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Pricing plan</h3>
        <form onSubmit={changePlan} className={styles.formRow}>
          <select className={styles.select} value={plan} onChange={e => setPlan(e.target.value)}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={loading}>Save plan</button>
        </form>
        <p className={styles.muted}>To handle payments and trials you must connect your payment provider (Polar, Stripe, etc.) server-side and record entitlement changes in the <code>profiles</code> table.</p>
      </section>

      {message && <div className={styles.msg}>{message}</div>}
    </div>
  );
}
