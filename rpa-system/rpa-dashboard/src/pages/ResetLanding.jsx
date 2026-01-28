import { useState, useMemo } from 'react';
import { useI18n } from '../i18n';
import supabase, { initSupabase } from '../utils/supabaseClient';
import styles from './ResetLanding.module.css';
import React from 'react';

function parseHashParams(hash) {
 if (!hash) return {};
 // strip leading #
 const clean = hash.startsWith('#') ? hash.slice(1) : hash;
 return clean.split('&').reduce((acc, pair) => {
 const [k, v] = pair.split('=');
 if (k) acc[k] = decodeURIComponent(v || '');
 return acc;
 }, {});
}

export default function ResetLanding() {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [done, setDone] = useState(false);
 const { t } = useI18n();

 const params = useMemo(() => parseHashParams(window.location.hash || window.location.search), []);
 const accessToken = params.access_token || params.accessToken || null;
 const refreshToken = params.refresh_token || params.refreshToken || null;
 const continueUrl = process.env.REACT_APP_PUBLIC_URL || window.location.origin;

 const onContinue = async () => {
 setError('');
 if (!accessToken && !refreshToken) {
 // nothing to do -- just navigate
 window.location.href = continueUrl;
 return;
 }
 setLoading(true);
 try {
 // supabase-js setSession expects object with access_token/refresh_token
 const client = await initSupabase();
 const { error: setErr } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
 if (setErr) throw setErr;
 setDone(true);
 // navigate to app root
 window.location.href = continueUrl;
 } catch (err) {
 setError(err?.message || 'Sign-in failed');
 setLoading(false);
 }
 };

 return (
 <div className={styles.container}>
 <h1>{t('reset.heading','Password reset / sign-in')}</h1>
 <p>{t('reset.intro','We received a password reset request. This page gives you control over when to continue into the app. Click Continue to sign in using the token that was embedded in the link.')}</p>

 <div className={styles.actions}>
 <button onClick={onContinue} disabled={loading || done} className={styles.button}>
 {loading ? t('reset.signing_in','Signing in...') : done ? t('reset.signed_in_continuing','Signed in -- continuing...') : t('reset.continue','Continue to app')}
 </button>
 </div>

 {error && <div className={styles.error}>{error}</div>}

 <p className={styles.description}>
 {t('reset.notice','If you didn\'t request this, please change your password after signing in or contact support.')}
 </p>
 </div>
 );
}

