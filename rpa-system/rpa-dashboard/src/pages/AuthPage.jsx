/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';
import React from 'react';
import { useI18n } from '../i18n';
import supabase, { initSupabase, signInWithPassword, signUp } from '../utils/supabaseClient';
import { useAuth } from '../utils/AuthContext';
import { trackEvent, triggerCampaign } from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { captureAndStoreUTM, getStoredUTMParams } from '../utils/utmCapture';
import { trackOnboardingStep } from '../utils/onboardingTracking';
import { createLogger } from '../utils/logger';
import { getEnvMessage } from '../utils/envAwareMessages';
import {
  trackSignupFormViewed,
  trackSignupAttempt,
  trackSignupValidationError,
  trackSignupFailure,
  trackSignupSuccess,
  SIGNUP_ERROR_TYPES
} from '../utils/signupTracking';
import { getABTestVariant, trackABTestView } from '../utils/abTesting';
import styles from './AuthPage.module.css';

const logger = createLogger('AuthPage');

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [signupFormVariant, setSignupFormVariant] = useState('A');
  const navigate = useNavigate();
  const { signIn } = useAuth(); // Use AuthContext signIn which has backend fallback
  // removed language context

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkUser = async () => {
      try {
        // Ensure Supabase client initialized before checking auth state
        const mod = await import('../utils/supabaseClient');
        if (mod && mod.initSupabase) await mod.initSupabase();
      } catch (e) {
        // ignore init errors and continue with stub behavior
      }
      const client = await initSupabase();
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        // User is already authenticated, redirect to dashboard
        navigate('/app');
      }
    };
    
    // Capture and store UTM parameters on page load
    captureAndStoreUTM();
    
    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      setMode('register'); // Switch to signup mode if there's a referral code
    }

    // ✅ A/B TESTING: Get signup form variant for testing
    const variant = getABTestVariant('signup_form');
    setSignupFormVariant(variant);
    if (variant) {
      trackABTestView('signup_form', variant).catch(e => 
        logger.debug('Failed to track signup_form A/B test view', { error: e })
      );
    }
    
    checkUser();
  }, []);

  // ✅ TRACKING: Track signup form viewed when mode switches to signup
  useEffect(() => {
    if (mode === 'signup' || mode === 'register') {
      const utmParams = getStoredUTMParams() || {};
      trackSignupFormViewed({
        variant: signupFormVariant,
        referral_code: referralCode || null,
        utm_source: utmParams?.source,
        utm_medium: utmParams?.medium,
        utm_campaign: utmParams?.campaign
      }).catch(e => logger.debug('Failed to track signup_form_viewed', { error: e }));
    }
  }, [mode, signupFormVariant, referralCode]);

  // Listen for auth state changes (ensure real client initialized first)
  useEffect(() => {
 let subscription = { unsubscribe: () => {} };
 (async () => {
 try {
 await initSupabase();
 } catch (e) {
 // ignore
 }

 try {
 const client = await initSupabase();
 const res = client.auth.onAuthStateChange(async (event, session) => {
 if (event === 'SIGNED_IN' && session?.user) {
 // Track email_verified if this is from email confirmation
 if (session?.user?.email_confirmed_at) {
 try {
 const { trackOnboardingStep } = await import('../utils/onboardingTracking');
 await trackOnboardingStep('email_verified', {
 user_id: session.user.id,
 email: session.user.email,
 confirmed_at: session.user.email_confirmed_at
 }).catch(e => logger.debug('Failed to track email_verified', { error: e }));
 } catch (e) {
 logger.debug('Failed to import/use onboarding tracking', { error: e });
 }
 }

 // Complete referral if there's a referral code
 if (referralCode) {
 try {
 const { api } = await import('../utils/api');
 await api.post('/api/complete-referral', { referralCode, newUserId: session.user.id });
 } catch (error) {
 logger.debug('complete-referral failed', { error, referralCode });
 }
 }

 if (sessionStorage.getItem('just_signed_up_pending') === 'true') {
 sessionStorage.setItem('just_signed_up', 'true');
 sessionStorage.removeItem('just_signed_up_pending');
 }

 navigate('/app');
 }
 
 // Track email_verified on TOKEN_REFRESHED event (also indicates confirmation)
 if (event === 'TOKEN_REFRESHED' && session?.user?.email_confirmed_at) {
 try {
 const { trackOnboardingStep } = await import('../utils/onboardingTracking');
 await trackOnboardingStep('email_verified', {
 user_id: session.user.id,
 email: session.user.email,
 confirmed_at: session.user.email_confirmed_at
 }).catch(e => logger.debug('Failed to track email_verified', { error: e }));
 } catch (e) {
 logger.debug('Failed to import/use onboarding tracking', { error: e });
 }
 }
 });
 if (res && res.data && res.data.subscription) subscription = res.data.subscription;
 } catch (e) {
 logger.debug('auth listener failed to attach', { error: e?.message || e });
 }
 })();

  return () => {
    try {
      subscription.unsubscribe();
    } catch (err) {
      logger.debug('AuthPage: subscription.unsubscribe failed', { error: err?.message || err });
    }
  };
 }, [navigate, referralCode]);

 const handleResetPassword = async () => {
 setError('');
 setSuccess('');
 const emailTrim = email.trim();
 if (!emailTrim) {
 setError(getEnvMessage({
 dev: 'Enter your email above first, then click Forgot password.',
 prod: 'Please enter your email address first.'
 }));
 return;
 }
 try {
 const redirectTo = `${window.location.origin}/auth/reset`;
 const client = await initSupabase();
 const { error } = await client.auth.resetPasswordForEmail(emailTrim, {
 redirectTo
 });
 if (error) throw error;
 setSuccess(getEnvMessage({
 dev: 'Password reset email sent. Check your inbox for further instructions.',
 prod: 'Password reset email sent. Please check your inbox.'
 }));
 } catch (err) {
 const msg = typeof err?.message === 'string' ? err.message : 'Failed to send reset email';
 setError(msg);
 }
 };

 const handleResendVerification = async () => {
 setLoading(true);
 try {
 const client = await initSupabase();
 const { error } = await client.auth.resend({
 type: 'signup',
 email: email
 });
 if (error) throw error;
 setSuccess(getEnvMessage({
 dev: 'Verification email resent! Please check your inbox.',
 prod: 'Verification email sent. Please check your inbox.'
 }));
 } catch (err) {
 logger.debug('resend verification failed', { error: err, email });
 setError(getEnvMessage({
 dev: `Failed to resend verification email: ${err?.message || err}`,
 prod: 'Failed to resend verification email. Please try again.'
 }));
 } finally {
 setLoading(false);
 }
 };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const utmParams = getStoredUTMParams() || {};

    // Basic client-side validation to reduce 400s
    const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (!isValidEmail(email)) {
      const errorMsg = getEnvMessage({
        dev: 'Please enter a valid email address.',
        prod: 'Please enter a valid email address.'
      });
      setError(errorMsg);
      
      // ✅ TRACKING: Track validation error
      if (mode === 'signup' || mode === 'register') {
        trackSignupValidationError(SIGNUP_ERROR_TYPES.VALIDATION, {
          field: 'email',
          variant: signupFormVariant,
          utm_source: utmParams?.source
        }).catch(e => logger.debug('Failed to track validation error', { error: e }));
      }
      return;
    }
    if (!password || password.length < 6) {
      const errorMsg = getEnvMessage({
        dev: 'Password must be at least 6 characters.',
        prod: 'Password must be at least 6 characters long.'
      });
      setError(errorMsg);
      
      // ✅ TRACKING: Track validation error
      if (mode === 'signup' || mode === 'register') {
        trackSignupValidationError(SIGNUP_ERROR_TYPES.VALIDATION, {
          field: 'password',
          variant: signupFormVariant,
          utm_source: utmParams?.source
        }).catch(e => logger.debug('Failed to track validation error', { error: e }));
      }
      return;
    }

    // ✅ TRACKING: Track signup/waitlist attempt (user clicked submit)
    if (mode === 'signup' || mode === 'register') {
      trackSignupAttempt({
        variant: signupFormVariant,
        referral_code: referralCode || null,
        utm_source: utmParams?.source,
        utm_medium: utmParams?.medium,
        utm_campaign: utmParams?.campaign,
        email_domain: email.split('@')[1] || null // Track email domain for analysis (not full email)
      }).catch(e => logger.debug('Failed to track signup_attempt', { error: e }));
    }

    setLoading(true);
    try {
      if (mode === 'login') {
 // Use AuthContext.signIn which tries backend first, then Supabase fallback
 const result = await signIn(email, password);
 // AuthContext.signIn returns { data: { user, session }, error: null }
 const data = result?.data || result; // Handle both formats
 const user = data?.user || result?.user;
 const session = data?.session || result?.session;
 
 if (!user) {
 throw new Error('Login failed: No user data returned');
 }
 
 // ✅ SMART REDIRECT: Check if user was trying to access a specific page
 const intendedPath = sessionStorage.getItem('intended_path') || '/app';
 sessionStorage.removeItem('intended_path');
 
 // Convert pending signup flag to active signup flag for conversion tracking
 const isNewUser = sessionStorage.getItem('just_signed_up_pending') === 'true';
 if (isNewUser) {
 sessionStorage.setItem('just_signed_up', 'true');
 sessionStorage.removeItem('just_signed_up_pending');
 // Track conversion event
 try { trackEvent({ user_id: user.id, event_name: 'user_signup_converted', properties: { source: 'login' } }); } catch (e) { logger.debug('trackEvent failed', { error: e, event: 'user_signup_converted' }); }
 }
 
 // Track login event and trigger any first-login campaigns
 try { trackEvent({ user_id: user.id, event_name: 'user_login' }); } catch (e) { logger.debug('trackEvent failed', { error: e, event: 'user_login' }); }
 try { trackEvent({ user_id: user.id, event_name: 'login_success', properties: { is_new_user: isNewUser } }); } catch (e) { logger.debug('trackEvent failed', { error: e, event: 'login_success' }); }
 try { triggerCampaign({ user_id: user.id, reason: 'first_login' }); } catch (e) { logger.debug('triggerCampaign failed', { error: e, reason: 'first_login' }); }
 
 // Track onboarding step: first_login
 if (isNewUser) {
 try { await trackOnboardingStep('first_login', { user_id: user.id }); } catch (e) { logger.debug('trackOnboardingStep failed', { error: e, step: 'first_login' }); }
 }
 
        // ✅ SMART REDIRECT: New users go to dashboard (has workflow creation prompt), existing users go to intended path or dashboard
        const redirectPath = isNewUser ? '/app' : intendedPath;
        const redirectMessage = isNewUser 
          ? getEnvMessage({
            dev: 'Welcome! Let\'s create your first automation...',
            prod: 'Welcome! Let\'s create your first automation...'
          })
          : getEnvMessage({
            dev: `Login successful! Redirecting${intendedPath !== '/app' ? ' to your destination' : ' to dashboard'}...`,
            prod: 'Login successful! Redirecting...'
          });
 
 setSuccess(redirectMessage);
 setTimeout(() => {
 navigate(redirectPath);
 }, 1500);
      } else {
        // WAITLIST FLOW: Capture email and put on waitlist instead of creating account
        const utmParams = getStoredUTMParams() || captureAndStoreUTM();
        try {
          const { api } = await import('../utils/api');
          await api.post('/api/capture-email', {
            email: email.trim(),
            source: 'waitlist',
            sessionCount: 0,
            userPlan: 'waitlist',
            timestamp: new Date().toISOString(),
            utm_source: utmParams?.source,
            utm_medium: utmParams?.medium,
            utm_campaign: utmParams?.campaign
          });

          // Track a waitlist-specific success event
          try { trackEvent({ event_name: 'waitlist_entry', properties: { email_domain: email.split('@')[1] || null, source: 'auth_page' } }); } catch (e) { logger.debug('trackEvent waitlist_entry failed', { error: e }); }

          setSuccess('Thanks — you are on the waitlist. We will email you when we open enrollment.');
        } catch (err) {
          logger.error('Waitlist capture error', { error: err, email });
          setError('Unable to add to waitlist at this time. Please try again later.');
        }
      }
    } catch (err) {
        logger.error('Authentication error', { error: err, mode, email: email ? email.substring(0, 3) + '***' : 'none' });
        
        // ✅ TRACKING: Track signup/waitlist failure with error categorization
        if (mode === 'signup' || mode === 'register') {
          try {
            trackSignupFailure(err, {
              variant: signupFormVariant,
              referral_code: referralCode || null,
              utm_source: (getStoredUTMParams() || {}).source || null,
              utm_medium: (getStoredUTMParams() || {}).medium || null,
              email_domain: email.split('@')[1] || null
            });
          } catch (e) { logger.debug('Failed to track signup_failure', { error: e }); }
        }

        const msg = typeof err?.message === 'string' ? err.message : String(err || 'Authentication failed');
        const status = err?.status;
        const lower = msg.toLowerCase();

 // Network-level or DNS failures often surface as TypeError: Failed to fetch
 if (err instanceof TypeError || lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error')) {
 setError(getEnvMessage({
 dev: `Network error: cannot reach the authentication server. Verify your SUPABASE_URL and network connectivity. Error: ${msg}`,
 prod: 'Network error: Cannot reach the authentication server. Please check your connection and try again.'
 }));
 } else if (msg.includes('ENOTFOUND') || msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('getaddrinfo')) {
 setError(getEnvMessage({
 dev: `DNS error: Supabase host could not be resolved. Check your SUPABASE_URL and DNS settings. Error: ${msg}`,
 prod: 'Connection error: Cannot reach the authentication server. Please try again later.'
 }));
 } else if (status === 429) {
 setError(getEnvMessage({
 dev: `Rate limited (429). Too many attempts. Please wait a minute and try again.`,
 prod: 'Too many attempts. Please wait a minute and try again.'
 }));
 } else if (lower.includes('email not confirmed')) {
 setError(getEnvMessage({
 dev: `Email not confirmed. Please check your inbox for the confirmation link. Error: ${msg}`,
 prod: 'Email not confirmed. Please check your inbox for the confirmation link.'
 }));
 } else if (lower.includes('user already registered')) {
 setError(getEnvMessage({
 dev: `User already registered. Try signing in or reset your password. Error: ${msg}`,
 prod: 'This email is already registered. Try signing in or reset your password.'
 }));
 } else if (lower.includes('invalid login credentials') || lower.includes('invalid email or password')) {
 setError(getEnvMessage({
 dev: `Invalid login credentials. Error: ${msg}`,
 prod: 'Invalid email or password. Please double-check your credentials and try again.'
 }));
 } else if (lower.includes('user not found')) {
 setError(getEnvMessage({
 dev: `User not found. Error: ${msg}`,
 prod: 'No account found with this email address. Please check your email or sign up for a new account.'
 }));
 } else if (lower.includes('wrong password') || lower.includes('incorrect password')) {
 setError(getEnvMessage({
 dev: `Incorrect password. Error: ${msg}`,
 prod: 'Incorrect password. Please try again or use "Forgot password?" to reset it.'
 }));
 } else if (status === 400) {
 setError(getEnvMessage({
 dev: `Invalid request (400). Error: ${msg}`,
 prod: 'Invalid email or password. Please double-check your credentials and try again.'
 }));
 } else if (status === 401) {
 setError(getEnvMessage({
 dev: `Unauthorized (401). Error: ${msg}`,
 prod: 'Authentication failed. Please check your email and password.'
 }));
 } else if (status === 422) {
 setError(getEnvMessage({
 dev: `Invalid email format (422). Error: ${msg}`,
 prod: 'Invalid email format. Please enter a valid email address.'
 }));
 } else {
 // Fallback to a user-friendly message instead of technical error
 setError(getEnvMessage({
 dev: `Unable to sign in. Error: ${msg} (Status: ${status || 'unknown'})`,
 prod: 'Unable to sign in. Please check your credentials and try again.'
 }));
 }

 // ✅ ANALYTICS: Track login failure for diagnostics
 try {
 trackEvent({
 event_name: 'login_failed',
 properties: {
 error_type: status ? `http_${status}` : 'unknown',
 error_category: lower.includes('network') ? 'network' :
 lower.includes('credentials') || lower.includes('password') ? 'credentials' :
 lower.includes('email') ? 'email' : 'other',
 mode: mode
 }
 });
 } catch (e) { logger.debug('trackEvent failed', { error: e, event: 'login_failed' }); }
 } finally {
 setLoading(false);
 }
 };

 const { t } = useI18n();

 return (
 <div className={styles.page}>
 <div className={styles.card}>
      <div className={styles.header}>
        {/* Google tag (gtag.js) should be included in public/index.html or via useEffect, not directly in JSX */}
        <h2 className={styles.title}>
          {mode === 'login' 
            ? t('auth.welcome_back','Welcome back') 
            : signupFormVariant === 'B' 
              ? 'Start Automating Today' 
              : t('auth.create_account','Create your account')
          }
        </h2>
        <p className={styles.subtitle}>
          {mode === 'login' 
            ? t('auth.sign_in_to_continue','Sign in to continue') 
            : signupFormVariant === 'B'
              ? 'Join thousands automating repetitive tasks'
              : t('auth.sign_up_to_continue','Sign up to continue')
          }
        </p>
      </div>
      <form onSubmit={onSubmit} className={`${styles.form} ${mode === 'signup' || mode === 'register' ? styles[`formVariant${signupFormVariant}`] : ''}`}>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="auth-email">{t('auth.email','Email')}</label>
            <input
              id="auth-email"
              name="email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                // Clear error when user starts typing
                if (error) setError('');
              }}
              placeholder={signupFormVariant === 'B' && (mode === 'signup' || mode === 'register') ? 'you@example.com' : ''}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="auth-password">{t('auth.password','Password')}</label>
            <input
              id="auth-password"
              name="password"
              className={styles.input}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                // Clear error when user starts typing
                if (error) setError('');
              }}
              placeholder={signupFormVariant === 'B' && (mode === 'signup' || mode === 'register') ? 'At least 6 characters' : ''}
              required
            />
            {signupFormVariant === 'B' && (mode === 'signup' || mode === 'register') && (
              <div className={styles.passwordHint}>
                Minimum 6 characters required
              </div>
            )}
          </div>
        </div>
 {error && (
 <div>
 <div className={styles.errorText}>{error}</div>
 {/* If rate-limited, offer a clearer instruction and a resend button for signups */}
 {mode === 'signup' && email && error.toLowerCase().includes('too many attempts') && (
 <div style={{ marginTop: 12, textAlign: 'center' }}>
 <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>
 Try again in a minute, check your Spam folder, or click Resend to attempt once more.
 </div>
 <button
 type="button"
 className={styles.secondaryButton}
 onClick={handleResendVerification}
 disabled={loading}
 style={{ fontSize: '0.9rem', padding: '8px 16px' }}
 >
 {loading ? t('action.sending','Sending...') : t('auth.resend_verification','Resend verification')}
 </button>
 </div>
 )}
 </div>
 )}
 {success && (
 <div>
 <div className={styles.subtitle} style={{ color: 'var(--color-success-700)' }}>{success}</div>
 {mode === 'signup' && (
 <div style={{ marginTop: '15px', textAlign: 'center' }}>
 <button
 type="button"
 className={styles.secondaryButton}
 onClick={handleResendVerification}
 disabled={loading}
 style={{ fontSize: '0.9rem', padding: '8px 16px' }}
 >
 {loading ? t('action.sending','Sending...') : t('auth.resend_verification_email','Resend Verification Email')}
 </button>
 </div>
 )}
 </div>
 )}
        <div className={styles.actions}>
          <button 
            type="submit" 
            className={`${styles.submitButton} ${signupFormVariant === 'B' && (mode === 'signup' || mode === 'register') ? styles.submitButtonVariantB : ''}`} 
            disabled={loading}
          >
            {loading 
              ? t('auth.please_wait','Please wait...') 
              : mode === 'login' 
                ? t('auth.sign_in','Sign In') 
                : signupFormVariant === 'B'
                  ? 'Get Started Free'
                  : t('auth.sign_up','Sign Up')
            }
          </button>
 <button
 type="button"
 className={styles.secondaryButton}
 onClick={() => {
 setMode(mode === 'login' ? 'signup' : 'login');
 // Clear error and success messages when switching modes
 setError('');
 setSuccess('');
 }}
 >
 {mode === 'login' ? t('auth.need_account','Need an account? Sign Up') : t('auth.have_account','Have an account? Sign In')}
 </button>
 {mode === 'login' && (
 <button
 type="button"
 className={styles.secondaryButton}
 onClick={handleResetPassword}
 >
 {t('auth.forgot_password','Forgot password?')}
 </button>
 )}
 </div>
 </form>
 <div className={styles.legalLinks}>
 <p className={styles.legalText}>
 By {mode === 'login' ? 'signing in' : 'signing up'}, you agree to our{' '}
 <Link to="/terms" className={styles.legalLink}>Terms of Use</Link>
 {' '}and{' '}
 <Link to="/privacy" className={styles.legalLink}>Privacy Policy</Link>.
 </p>
 </div>
 </div>
 </div>
 );
}
