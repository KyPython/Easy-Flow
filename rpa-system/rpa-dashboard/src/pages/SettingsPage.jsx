import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import {
  generateReferral,
  getPlans,
  getSubscription,
  createCheckoutSession,
} from '../utils/api';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  // UI state
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Error states for each section
  const [themeError, setThemeError] = useState('');
  const [referralError, setReferralError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [planError, setPlanError] = useState('');

  // Password
  const [password, setPassword] = useState('');

  // Referral
  const [referralUrl, setReferralUrl] = useState('');

  // Subscription/plans (functionality from 1st duplicate)
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [plan, setPlan] = useState('free'); // UI from 2nd duplicate (select)

  // Load subscription and plans on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        setPageLoading(true);
        const [subData, plansData] = await Promise.all([
          getSubscription(),
          getPlans(),
        ]);

        if (!mounted) return;

        setSubscription(subData?.subscription || null);
        setPlans(Array.isArray(plansData) ? plansData : []);

        // Default the select to the current plan id if present
        const currentPlanId =
          subData?.subscription?.plan_id ??
          subData?.subscription?.plans?.id ??
          'free';
        setPlan(currentPlanId);
      } catch (error) {
        console.error(error);
        setMessage('Error: Could not load subscription data.');
        setPlanError('Error: Could not load subscription data.');
      } finally {
        if (mounted) setPageLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  async function updatePassword(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setPasswordError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(`Failed: ${error.message}`);
        setPasswordError(error.message);
      }
      else setMessage('Password updated successfully.');
    } catch {
      setMessage('Unexpected error');
      setPasswordError('Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  // Keep 1st-duplicate functionality: plan change creates a checkout session
  async function changePlan(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setPlanError('');
    try {
      const session = await createCheckoutSession(plan);
      if (session?.url) {
        window.location.href = session.url;
      } else {
        setMessage('Could not initiate plan change. Please try again.');
        setPlanError('Could not initiate plan change. Please try again.');
      }
    } catch (error) {
      console.error(error);
      setMessage('Error: Could not initiate plan change.');
      setPlanError('Error: Could not initiate plan change.');
    } finally {
      setLoading(false);
    }
  }

  const currentPlanId =
    subscription?.plan_id ?? subscription?.plans?.id ?? 'free';

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Settings</h2>

      {/* Theme (UI from 2nd) */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Theme</h3>
        <p className={styles.muted}>Current: {theme}</p>
        <div className={styles.formRow}>
          <button
            className={`${styles.btn} ${styles.btnAlt}`}
            onClick={() => {
              try {
                toggle();
                setThemeError('');
              } catch (err) {
                setThemeError('Failed to toggle theme.');
              }
            }}
            type="button"
          >
            {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          </button>
        </div>
        {themeError && <div className={styles.error}>{themeError}</div>}
      </section>

      {/* Referrals (UI from 2nd) */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Referrals</h3>
        <p className={styles.muted}>
          Share EasyFlow and get credit for new signups.
        </p>
        <div className={styles.formRow}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="button"
            onClick={async () => {
              setMessage('');
              setReferralError('');
              try {
                const resp = await generateReferral();
                if (resp && resp.ok) {
                  setReferralUrl(resp.url || '');
                  setMessage('Referral generated.');
                } else {
                  setMessage('Failed to generate referral.');
                  setReferralError('Failed to generate referral.');
                }
              } catch {
                setMessage('Unexpected error generating referral');
                setReferralError('Unexpected error generating referral');
              }
            }}
            disabled={loading}
          >
            Generate referral
          </button>
        </div>
        {referralError && <div className={styles.error}>{referralError}</div>}
        {referralUrl && (
          <div style={{ marginTop: 12 }}>
            <a href={referralUrl} target="_blank" rel="noreferrer">
              {referralUrl}
            </a>
          </div>
        )}
      </section>

      {/* Change password (UI from 2nd) */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Change password</h3>
        <form onSubmit={updatePassword} className={styles.formRow}>
          <input
            className={styles.input}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="submit"
            disabled={loading}
          >
            Update password
          </button>
        </form>
        {passwordError && <div className={styles.error}>{passwordError}</div>}
      </section>

      {/* Pricing plan (UI from 2nd, functionality from 1st) */}
      <section className={styles.section}>
        <h3 className={styles.heading}>Pricing plan</h3>
        {pageLoading ? (
          <p className={styles.muted}>Loading subscription details...</p>
        ) : (
          <>
            <p className={styles.muted} style={{ marginBottom: 12 }}>
              Current plan:{' '}
              <strong>
                {subscription?.plans?.name || subscription?.plan_id || 'Free'}
              </strong>
            </p>
            <form onSubmit={changePlan} className={styles.formRow}>
              <select
                className={styles.select}
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${(p.price_cents / 100).toFixed(2)}/month
                  </option>
                ))}
              </select>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="submit"
                disabled={loading || plan === currentPlanId}
                title={plan === currentPlanId ? 'Already on this plan' : ''}
              >
                {plan === currentPlanId ? 'Current Plan' : 'Save plan'}
              </button>
            </form>
            {planError && <div className={styles.error}>{planError}</div>}
            <p className={styles.muted}>
              To handle payments and trials you must connect your payment
              provider server-side and record entitlements accordingly.
            </p>
          </>
        )}
      </section>

      {message && <div className={styles.msg}>{message}</div>}
    </div>
  );
};