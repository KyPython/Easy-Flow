import React, { useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

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

  const params = useMemo(() => parseHashParams(window.location.hash || window.location.search), []);
  const accessToken = params.access_token || params.accessToken || null;
  const refreshToken = params.refresh_token || params.refreshToken || null;
  const continueUrl = process.env.REACT_APP_PUBLIC_URL || window.location.origin;

  const onContinue = async () => {
    setError('');
    if (!accessToken && !refreshToken) {
      // nothing to do — just navigate
      window.location.href = continueUrl;
      return;
    }
    setLoading(true);
    try {
      // supabase-js setSession expects object with access_token/refresh_token
      const { error: setErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
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
    <div style={{ maxWidth: 720, margin: '4rem auto', fontFamily: 'system-ui, Arial', padding: 20 }}>
      <h1>Password reset / sign-in</h1>
      <p>
        We received a password reset request. This page gives you control over when to continue into the
        app. Click Continue to sign in using the token that was embedded in the link.
      </p>

      <div style={{ marginTop: 24 }}>
        <button onClick={onContinue} disabled={loading || done} style={{ padding: '10px 18px', background: '#2563eb', color: 'white', borderRadius: 6, border: 'none' }}>
          {loading ? 'Signing in…' : done ? 'Signed in — continuing…' : 'Continue to app'}
        </button>
      </div>

      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

      <p style={{ marginTop: 18, color: '#666' }}>
        If you didn't request this, please change your password after signing in or contact support.
      </p>
    </div>
  );
}

