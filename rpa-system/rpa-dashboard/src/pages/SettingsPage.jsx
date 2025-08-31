import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { generateReferral } from '../utils/api';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  // UI state
  const [, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Error states
  const [themeError, setThemeError] = useState('');
  const [referralError, setReferralError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [planError, setPlanError] = useState('');

  // Password & Referral
  const [password, setPassword] = useState('');
  const [referralUrl, setReferralUrl] = useState('');

  // Plans & subscription
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [planId, setPlanId] = useState(null); // selected plan ID
  const [pageLoading, setPageLoading] = useState(true);

  // Fetch subscription
  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    try {
      setPageLoading(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // safer than .single()

      if (error) throw error;
      setSubscription(data || null);
      setPlanId(data?.plan?.id || null);
    } catch (err) {
      console.error(err);
      setPlanError('Error fetching subscription');
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  // Fetch all plans
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, price_cents, billing_interval, polar_url, description')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlanError('Error loading plans');
    }
  }, []);

  // Set default planId after plans load
  useEffect(() => {
    if (plans.length && !planId) {
      setPlanId(subscription?.plan?.id || plans[0].id);
    }
  }, [plans, subscription, planId]);

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
  }, [fetchSubscription, fetchPlans]);

  // Update password
  async function updatePassword(e) {
    e.preventDefault();
    setLoading(true);
    setPasswordError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setPasswordError(error.message);
      else setMessage('Password updated successfully.');
    } catch {
      setPasswordError('Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  // Change plan
  async function changePlan(e) {
    e.preventDefault();
    if (!planId) return;
    setLoading(true);
    setPlanError('');
    setMessage('');

    try {
      const selected = plans.find((p) => String(p.id) === String(planId));
      if (!selected) throw new Error('Plan not found');

      if (!selected.polar_url) {
        setPlanError('No checkout URL for this plan');
        return;
      }

      window.open(selected.polar_url, '_blank');
    } catch (err) {
      console.error(err);
      setPlanError('Failed to start plan');
    } finally {
      setLoading(false);
    }
  }

  const currentPlanId = subscription?.plan?.id || null;

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Settings</h2>

      {/* Theme */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Theme</h3>
        <p className={styles.muted}>Current: {theme}</p>
        <button
          className={`${styles.btn} ${styles.btnAlt}`}
          type="button"
          onClick={() => {
            try { toggle(); setThemeError(''); } 
            catch { setThemeError('Failed to toggle theme.'); }
          }}
        >
          {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
        </button>
        {themeError && <div className={styles.error}>{themeError}</div>}
      </section>

      {/* Referrals */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Referrals</h3>
        <p className={styles.muted}>Share EasyFlow and get credit for new signups.</p>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={async () => {
            setReferralError('');
            setMessage('');
            try {
              const resp = await generateReferral();
              if (resp && resp.ok) {
                setReferralUrl(resp.url || '');
                setMessage('Referral generated.');
              } else {
                setReferralError('Failed to generate referral.');
              }
            } catch {
              setReferralError('Unexpected error generating referral');
            }
          }}
        >
          Generate referral
        </button>
        {referralError && <div className={styles.error}>{referralError}</div>}
        {referralUrl && <div><a href={referralUrl} target="_blank" rel="noreferrer">{referralUrl}</a></div>}
      </section>

      {/* Password */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Change password</h3>
        <form onSubmit={updatePassword} className={styles.formRow}>
          <input
            className={styles.input}
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={loading}>
            Update password
          </button>
        </form>
        {passwordError && <div className={styles.error}>{passwordError}</div>}
      </section>

      {/* Plans */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Pricing plan</h3>
        {pageLoading ? (
          <p className={styles.muted}>Loading subscription details...</p>
        ) : (
          <>
            <p className={styles.muted}>
              Current plan: <strong>{subscription?.plan?.name || 'Free'}</strong>
            </p>
            <form onSubmit={changePlan} className={styles.formRow}>
              <select
                className={styles.select}
                value={planId || ''}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name.charAt(0).toUpperCase() + p.name.slice(1)} — 
                    {p.price_cents === 0 ? '$0/month' : `$${(p.price_cents / 100).toFixed(2)}/${p.billing_interval}`}
                  </option>
                ))}
              </select>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="submit"
                disabled={loading || String(planId) === String(currentPlanId)}
                title={String(planId) === String(currentPlanId) ? 'Already on this plan' : ''}
              >
                {String(planId) === String(currentPlanId) ? 'Current Plan' : 'Save plan'}
              </button>
            </form>
            {planError && <div className={styles.error}>{planError}</div>}
          </>
        )}
      </section>
    </div>
  );
}
