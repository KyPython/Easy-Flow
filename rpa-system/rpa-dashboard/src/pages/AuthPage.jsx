import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';
import { supabase } from '../utils/supabaseClient';
import { trackEvent, triggerCampaign } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const navigate = useNavigate();
  // removed language context

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // User is already authenticated, redirect to dashboard
        navigate('/app');
      }
    };
    
    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      setMode('register'); // Switch to signup mode if there's a referral code
    }
    
    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Complete referral if there's a referral code
        if (referralCode) {
          try {
            const response = await fetch('/api/complete-referral', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                referralCode: referralCode,
                newUserId: session.user.id
              })
            });
            
            if (response.ok) {
            }
          } catch (error) {
            // Error handling logic (optional: show user feedback)
          }
        }
        
        // Check if this is a signup completion by looking for signup flag
        if (sessionStorage.getItem('just_signed_up_pending') === 'true') {
          sessionStorage.setItem('just_signed_up', 'true');
          sessionStorage.removeItem('just_signed_up_pending');
        }
        
        // User just signed in or was confirmed, redirect to dashboard
        navigate('/app');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, referralCode]);

  const handleResetPassword = async () => {
    setError('');
    setSuccess('');
    const emailTrim = email.trim();
    if (!emailTrim) {
  setError('Enter your email above first, then click Forgot password.');
      return;
    }
    try {
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(emailTrim, {
        redirectTo
      });
      if (error) throw error;
  setSuccess('Password reset email sent. Check your inbox for further instructions.');
    } catch (err) {
      const msg = typeof err?.message === 'string' ? err.message : 'Failed to send reset email';
      setError(msg);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      if (error) throw error;
  setSuccess('Verification email resent! Please check your inbox.');
    } catch (err) {
      console.debug('resend verification failed', err);
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Basic client-side validation to reduce 400s
    const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (!isValidEmail(email)) {
  setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
  setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          // Successful login - redirect to dashboard
          setSuccess('Login successful! Redirecting to dashboard...');
          // Track login event and trigger any first-login campaigns
          try { trackEvent({ user_id: data.user?.id, event_name: 'user_login' }); } catch (e) { console.debug('trackEvent failed', e); }
          try { triggerCampaign({ user_id: data.user?.id, reason: 'first_login' }); } catch (e) { console.debug('triggerCampaign failed', e); }
          setTimeout(() => {
            navigate('/app');
          }, 1500);
      } else {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          // Set flag to indicate this was a signup (will be converted to tracking flag on successful auth)
          sessionStorage.setItem('just_signed_up_pending', 'true');
          // If confirmations are enabled, inform the user
          setSuccess('Sign-up successful! Please check your email to confirm your account.');
          // Track signup event and trigger welcome campaign after sign-up (server-side will resolve user id when they first login)
          try { trackEvent({ event_name: 'user_signup', properties: { email } }); } catch (e) { console.debug('trackEvent failed', e); }
          try { triggerCampaign({ email, reason: 'signup' }); } catch (e) { console.debug('triggerCampaign failed', e); }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      const msg = typeof err?.message === 'string' ? err.message : 'Authentication failed';
      const status = err?.status;
      const lower = msg.toLowerCase();
      
      if (status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (lower.includes('email not confirmed')) {
        setError('Email not confirmed. Please check your inbox for the confirmation link.');
      } else if (lower.includes('user already registered')) {
        setError('This email is already registered. Try signing in or reset your password.');
      } else if (lower.includes('invalid login credentials')) {
        setError('Invalid email or password. Please double-check your credentials and try again.');
      } else if (lower.includes('invalid email or password')) {
        setError('Invalid email or password. Please double-check your credentials and try again.');
      } else if (lower.includes('user not found')) {
        setError('No account found with this email address. Please check your email or sign up for a new account.');
      } else if (lower.includes('wrong password') || lower.includes('incorrect password')) {
        setError('Incorrect password. Please try again or use "Forgot password?" to reset it.');
      } else if (status === 400) {
        setError('Invalid email or password. Please double-check your credentials and try again.');
      } else if (status === 401) {
        setError('Authentication failed. Please check your email and password.');
      } else if (status === 422) {
        setError('Invalid email format. Please enter a valid email address.');
      } else {
        // Fallback to a user-friendly message instead of technical error
        setError('Unable to sign in. Please check your credentials and try again.');
      }
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
  <h2 className={styles.title}>{mode === 'login' ? t('auth.welcome_back','Welcome back') : t('auth.create_account','Create your account')}</h2>
  <p className={styles.subtitle}>{mode === 'login' ? t('auth.sign_in_to_continue','Sign in to continue') : t('auth.sign_up_to_continue','Sign up to continue')}</p>
</div>
        <form onSubmit={onSubmit} className={styles.form}>
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
                required
              />
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
              {loading ? t('action.sending','Sending…') : t('auth.resend_verification','Resend verification')}
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
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? t('auth.please_wait','Please wait…') : (mode === 'login' ? t('auth.sign_in','Sign In') : t('auth.sign_up','Sign Up'))}
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
      </div>
    </div>
  );
}
