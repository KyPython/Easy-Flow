import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { api } from '../utils/api';
import styles from './SettingsPage.module.css';
import ReferralForm from '../components/ReferralForm';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../i18n';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { setLanguage } = useLanguage();
  const { t } = useI18n();

  // UI state
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);

  // Error states
  const [themeError, setThemeError] = useState('');
  const [referralError, setReferralError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [planError, setPlanError] = useState('');
  const [preferencesError, setPreferencesError] = useState('');

  // Password
  const [password, setPassword] = useState('');

  // Plans & subscription
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // User Preferences
  const [preferences, setPreferences] = useState({
    notification_preferences: {
      email_notifications: true,
      weekly_reports: true,
      sms_alerts: false,
      push_notifications: true,
      task_completion: true,
      task_failures: true,
      system_alerts: true,
      marketing_emails: true,
      security_alerts: true
    },
    ui_preferences: {
      theme: 'light',
      dashboard_layout: 'grid',
      timezone: 'UTC',
      date_format: 'MM/DD/YYYY',
      language: 'en'
    },
    phone_number: '',
    fcm_token: null
  });
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesModified, setPreferencesModified] = useState(false);

  // Helper: format E.164 (+1XXXXXXXXXX) or raw digits to display form: (XXX) XXX-XXXX
  const formatPhoneForDisplay = (value) => {
    if (!value) return '';
    // Strip non-digits
    let digits = String(value).replace(/\D/g, '');
    // Remove leading 1 if length > 10 and starts with 1 (US country code)
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    if (!digits) return '';
    digits = digits.slice(0, 10); // limit to 10 national digits
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 10);
    let formatted = '';
    if (part1) formatted = `(${part1}`;
    if (part1 && part1.length === 3) formatted += ')';
    if (part2) formatted += ` ${part2}`;
    if (part3) formatted += `-${part3}`;
    return formatted.trim();
  };

  // Helper: normalize display phone to E.164 (+1XXXXXXXXXX) for US numbers
  const normalizePhoneForSave = (displayValue) => {
    if (!displayValue) return null;
    let digits = displayValue.replace(/\D/g, '');
    if (!digits) return null;
    // If 10 digits assume US number; prepend country code 1
    if (digits.length === 10) return `+1${digits}`;
    // If 11 digits starting with 1 treat as US (already includes country)
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    // Fallback: if already starts with country code and plus sign was removed above
    return `+${digits}`; // best effort
  };

  // Fetch user preferences
  const fetchedOnceRef = useRef(false);
  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    if (fetchedOnceRef.current) return; // prevent duplicate invocations (React 18 strict mode / rerenders)
    fetchedOnceRef.current = true;
    try {
      setPreferencesLoading(true);
      const response = await api.get('/api/user/preferences');
      if (response.status === 200) {
        const data = response.data || {};
        setPreferences(prev => ({
          ...prev,
          ...data,
          phone_number: formatPhoneForDisplay(data.phone_number)
        }));
      } else {
        console.error('Failed to fetch preferences (non-200)', response.status);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
      if (err?.response?.status === 401) {
        // Allow a later manual retry if auth becomes valid
        fetchedOnceRef.current = false; // so user can trigger via manual action if we add one later
      }
      // Provide user-friendly error message
      if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        setPreferencesError('Unable to connect to settings. Please try again in a moment.');
      } else if (err?.response?.status === 401) {
        setPreferencesError('You are not authorized yet. Please re-login or refresh.');
      } else {
        setPreferencesError('Unable to load your preferences. Please refresh the page.');
      }
    } finally {
      setPreferencesLoading(false);
    }
  }, [user]);

  // Save user preferences
  const savePreferences = async () => {
    if (!user) return;
    setLoading(true);
    setPreferencesError('');
    setMessage('');

    try {
      // Normalize phone number for backend (store E.164) while keeping display version locally
      const normalizedPhone = normalizePhoneForSave(preferences.phone_number);
      const payload = { ...preferences, phone_number: normalizedPhone };
      const response = await api.put('/api/user/preferences', payload);

      if (response.status === 200) {
        setMessage('Preferences updated successfully');
        setPreferencesModified(false);
        // Re-format any stored phone for display after successful save
        if (normalizedPhone) {
          setPreferences(prev => ({ ...prev, phone_number: formatPhoneForDisplay(normalizedPhone) }));
        }
      } else {
        setPreferencesError(response.data.error || 'Failed to update preferences');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      
      // Provide user-friendly error message
      if (err.message?.includes('Network Error') || err.message?.includes('CORS')) {
        setPreferencesError('Unable to save preferences. Please check your connection and try again.');
      } else {
        setPreferencesError('Unable to save preferences. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Update notification preference
  const updateNotificationPref = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [key]: value
      }
    }));
    setPreferencesModified(true);
  };

  // Update UI preference
  const updateUIPref = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      ui_preferences: {
        ...prev.ui_preferences,
        [key]: value
      }
    }));
    setPreferencesModified(true);
    if (key === 'language') {
      // apply immediately without altering original copy anywhere else
      setLanguage(value);
    }
  };

  // Update contact info
  const updateContactInfo = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    setPreferencesModified(true);
  };

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
        .maybeSingle();

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
    fetchPreferences();
  }, [fetchSubscription, fetchPlans, fetchPreferences]);

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
  const proPlan = plans.find(p => p.price_cents > 0 && p.name.toLowerCase().includes('pro')) || plans.find(p => p.price_cents > 0);

  return (
    <div className={styles.page}>
  <h2 className={styles.heading}>{t('settings.title','Settings')}</h2>

      {/* Show feedback message */}
      {message && <div className={styles.success}>{message}</div>}
      {preferencesError && <div className={styles.error}>{preferencesError}</div>}

      {/* Notification Preferences */}
      <section className={styles.section}>
  <h3 className={styles.heading}>{t('settings.notification_preferences','Notification Preferences')}</h3>
        {preferencesLoading ? (
          <p className={styles.muted}>Loading preferences...</p>
        ) : (
          <>
            <div className={styles.preferencesGrid}>
            <div className={styles.preferenceGroup}>
              <h4 className={styles.subHeading}>Email Notifications</h4>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.email_notifications}
                  onChange={(e) => updateNotificationPref('email_notifications', e.target.checked)}
                />
                <span className={styles.checkboxText}>Email notifications</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.weekly_reports}
                  onChange={(e) => updateNotificationPref('weekly_reports', e.target.checked)}
                />
                <span className={styles.checkboxText}>Weekly reports</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.marketing_emails}
                  onChange={(e) => updateNotificationPref('marketing_emails', e.target.checked)}
                />
                <span className={styles.checkboxText}>Marketing emails</span>
              </label>
            </div>

            <div className={styles.preferenceGroup}>
              <h4 className={styles.subHeading}>Task Notifications</h4>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.task_completion}
                  onChange={(e) => updateNotificationPref('task_completion', e.target.checked)}
                />
                <span className={styles.checkboxText}>Task completions</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.task_failures}
                  onChange={(e) => updateNotificationPref('task_failures', e.target.checked)}
                />
                <span className={styles.checkboxText}>Task failures</span>
              </label>
            </div>

            <div className={styles.preferenceGroup}>
              <h4 className={styles.subHeading}>System & Security</h4>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.system_alerts}
                  onChange={(e) => updateNotificationPref('system_alerts', e.target.checked)}
                />
                <span className={styles.checkboxText}>System alerts</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.security_alerts}
                  onChange={(e) => updateNotificationPref('security_alerts', e.target.checked)}
                />
                <span className={styles.checkboxText}>Security alerts</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.push_notifications}
                  onChange={(e) => updateNotificationPref('push_notifications', e.target.checked)}
                />
                <span className={styles.checkboxText}>Push notifications</span>
              </label>
            </div>

            <div className={styles.preferenceGroup}>
              <h4 className={styles.subHeading}>SMS Alerts</h4>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notification_preferences.sms_alerts}
                  onChange={(e) => updateNotificationPref('sms_alerts', e.target.checked)}
                />
                <span className={styles.checkboxText}>SMS alerts</span>
              </label>
              <p className={styles.muted}>Phone number required for SMS alerts</p>
            </div>
            </div>
          
            {preferencesModified && (
              <div className={styles.savePrompt}>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={savePreferences}
                  disabled={loading}
                >
                  {loading ? t('action.saving','Saving...') : t('settings.save_notification_preferences','Save notification preferences')}
                </button>
              </div>
            )}
          </>
        )}
      </section>      {/* Contact Information */}
      <section className={styles.section}>
  <h3 className={styles.heading}>{t('settings.contact_information','Contact Information')}</h3>
        {!preferencesLoading && (
          <div className={styles.contactForm}>
            <div className={styles.formRow}>
              <label className={styles.label}>
                Phone Number (for SMS alerts)
                <input
                  className={styles.input}
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={preferences.phone_number || ''}
                  onChange={(e) => {
                    const formatted = formatPhoneForDisplay(e.target.value);
                    updateContactInfo('phone_number', formatted);
                  }}
                />
              </label>
            </div>
            <p className={styles.muted}>
              Phone number is required to receive SMS alerts. Format: +1 (555) 123-4567
            </p>
            {preferencesModified && (
              <div className={styles.savePrompt}>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={savePreferences}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Contact Info'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* UI Preferences */}
      <section className={styles.section}>
  <h3 className={styles.heading}>{t('settings.interface_preferences','Interface Preferences')}</h3>
        {!preferencesLoading && (
          <div className={styles.uiPreferences}>
            <div className={styles.formRow}>
              <label className={styles.label}>
                Dashboard Layout
                <select
                  className={styles.select}
                  value={preferences.ui_preferences.dashboard_layout}
                  onChange={(e) => updateUIPref('dashboard_layout', e.target.value)}
                >
                  <option value="grid">Grid Layout</option>
                  <option value="list">List Layout</option>
                  <option value="compact">Compact Layout</option>
                </select>
              </label>
            </div>
            
            <div className={styles.formRow}>
              <label className={styles.label}>
                Timezone
                <select
                  className={styles.select}
                  value={preferences.ui_preferences.timezone}
                  onChange={(e) => updateUIPref('timezone', e.target.value)}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </label>
            </div>

            <div className={styles.formRow}>
              <label className={styles.label}>
                Date Format
                <select
                  className={styles.select}
                  value={preferences.ui_preferences.date_format}
                  onChange={(e) => updateUIPref('date_format', e.target.value)}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD MMM YYYY">DD MMM YYYY</option>
                </select>
              </label>
            </div>

            <div className={styles.formRow}>
              <label className={styles.label}>
                Language
                <select
                  className={styles.select}
                  value={preferences.ui_preferences.language}
                  onChange={(e) => updateUIPref('language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Português</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </section>
      {/* Extra save button near UI section if modified */}
      {preferencesModified && (
        <div className={styles.savePrompt}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={savePreferences}
            disabled={loading}
          >
            {loading ? t('action.saving','Saving...') : t('action.save','Save')}
          </button>
        </div>
      )}

      {/* Theme */}
      <section className={styles.section}>
        <h3 className={styles.heading}>{t('settings.theme','Theme')}</h3>
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
        <h3 className={styles.heading}>{t('settings.referrals','Referrals')}</h3>
          <p className={styles.muted}>
          Share EasyFlow and get credit for new signups.<br />
          <strong>How it works:</strong> Enter your friend&apos;s email. We&apos;ll send them an invite. If they sign up, you&apos;ll get <strong>1 month free of the Pro plan</strong> automatically!
        </p>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={() => {
            setShowReferralForm(true);
            setMessage('');
            setReferralError('');
          }}
        >
          Generate referral
        </button>
        {referralError && <div className={styles.error}>{referralError}</div>}
        {showReferralForm && (
          <ReferralForm
            referrerEmail={user?.email || ''}
            proPlan={proPlan}
            onClose={() => setShowReferralForm(false)}
            onSuccess={() => {
              setShowReferralForm(false);
              setMessage('Referral sent! Your friend will get an invite email. If they sign up, you will automatically earn 1 month free of the Pro plan.');
            }}
            onError={err => setReferralError(err)}
          />
        )}
      </section>

      {/* Password */}
      <section className={styles.section}>
  <h3 className={styles.heading}>{t('settings.change_password','Change password')}</h3>
        <form onSubmit={updatePassword} className={styles.formRow}>
          <input
            className={styles.input}
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={loading}>
            {t('action.update_password','Update password')}
          </button>
        </form>
        {passwordError && <div className={styles.error}>{passwordError}</div>}
      </section>

      {/* Plans */}
      <section className={styles.section}>
  <h3 className={styles.heading}>{t('settings.pricing_plan','Pricing plan')}</h3>
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
                {String(planId) === String(currentPlanId) ? t('plan.current_plan','Current Plan') : t('plan.save_plan','Save plan')}
              </button>
            </form>
            {planError && <div className={styles.error}>{planError}</div>}
          </>
        )}
      </section>
    </div>
  );
}