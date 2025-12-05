import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import supabase, { initSupabase } from './supabaseClient';
import { fetchWithAuth } from './devNetLogger';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Check if backend authentication is available
  // Always use fetchWithAuth and handle 401 gracefully
  // Accept an explicit token to avoid races with localStorage writes
  const checkBackendAuth = async (explicitToken = null) => {
    try {
      // Only call backend session endpoint if we have a token or cookies to send
      let token = explicitToken;
      if (!token) {
        try { token = localStorage.getItem('dev_token') || localStorage.getItem('authToken') || localStorage.getItem('token'); } catch (e) { token = null; }
        if (token === 'undefined' || token === 'null') token = null;
      }
      const hasCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.length > 0);
      if (!token && !hasCookie) {
        // No credentials available to send; skip backend call to avoid 401
        console.debug('[Auth] No token or cookies found; skipping backend /api/auth/session call.');
        return false;
      }

      // Provide Authorization header if token present. Only send cookies when a
      // cookie is actually present on the document (explicit opt-in per-request).
      const response = await fetchWithAuth('/api/auth/session', {
        credentials: hasCookie ? 'include' : 'omit'
      });
      
      // Check if response is OK and has correct content type
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      if (response.status === 401) {
        console.log('[Auth] Backend returned 401, clearing session');
        setUser(null);
        setSession(null);
        localStorage.removeItem('dev_token');
        return false;
      }
      
      // If response is not JSON, log the actual content for debugging
      if (!isJson) {
        const errorText = await response.text();
        console.error('[Auth] Backend returned non-JSON response:', {
          status: response.status,
          statusText: response.statusText,
          contentType: contentType,
          bodyPreview: errorText.substring(0, 200), // First 200 chars
          url: '/api/auth/session'
        });
        throw new Error(`Backend returned ${response.status} ${response.statusText} with content-type ${contentType}. Backend may be down or returning HTML error page.`);
      }
      
      if (response.ok) {
        const sessionData = await response.json();
        if (sessionData.user) {
          setUser(sessionData.user);
          setSession(sessionData);
          return true;
        }
      } else {
        // Non-200 status with JSON response
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Auth] Backend session check returned error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
      }
    } catch (error) {
      // IMPROVED: Don't clear session on network errors - preserve existing session
      // This prevents sign-out on page refresh when backend is temporarily unreachable
      if (error.message && error.message.includes('JSON')) {
        console.error('[Auth] Backend session check failed - received HTML instead of JSON. Backend may be down or misconfigured:', error.message);
      } else {
        console.warn('[Auth] Backend session check failed (network error):', error.message);
      }
      console.log('[Auth] Preserving existing session state due to network error');
      // Don't clear user/session - let the existing Supabase session persist
      // Only clear on explicit 401 (handled above)
    }
    return false;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('[Auth] Initializing authentication...');
      try {
        // Ensure Supabase client is initialized so auth methods and listeners
        // attach to the real client rather than to the stub.
        try {
          await initSupabase();
        } catch (e) {
          console.warn('[Auth] Supabase init failed, continuing with stub:', e.message);
        }
        // Prefer Supabase client-side session if available so we can forward its token to backend
        try {
          const client = await initSupabase();
          const { data: { session: sbSession }, error } = await client.auth.getSession();
          if (!error && sbSession) {
            console.log('[Auth] Found existing Supabase session for:', sbSession.user?.email);
            // Store token so fetchWithAuth will include Authorization header
            if (sbSession.access_token) {
              try { localStorage.setItem('dev_token', sbSession.access_token); } catch (e) {}
            }
            setSession(sbSession);
            setUser(sbSession?.user ?? null);
          } else if (error) {
            console.warn('[Auth] Supabase getSession error:', error.message);
          } else {
            console.log('[Auth] No existing Supabase session found');
          }
        } catch (supabaseError) {
          console.warn('[Auth] Supabase not available:', supabaseError.message);
        }

        // Ensure token is read from storage (or session) and passed explicitly to avoid races
        let startupToken = null;
        try { startupToken = localStorage.getItem('dev_token') || localStorage.getItem('authToken') || localStorage.getItem('token'); } catch (e) { startupToken = null; }
        if (startupToken === 'undefined' || startupToken === 'null') startupToken = null;

        // Then try backend auth (will accept Authorization header or cookie if present)
        await checkBackendAuth(startupToken);
        console.log('[Auth] Initialization complete, user:', user?.email || 'none');
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up Supabase auth listener (attach after attempting init)
    let subscription = null;
    (async () => {
      try {
        const client = await initSupabase();
        const res = client.auth.onAuthStateChange((event, nextSession) => {
          if (event === 'INITIAL_SESSION') return;
          console.log('Auth state changed:', event, nextSession?.user?.email || 'no user');
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setLoading(false);
        });
        subscription = (res && res.data && res.data.subscription) ? res.data.subscription : null;
      } catch (error) {
        console.warn('Could not set up auth listener:', error && error.message ? error.message : error);
      }
    })();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      
      // Try backend authentication first
      try {
        const hasCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.length > 0);
        const response = await fetchWithAuth('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
          credentials: hasCookie ? 'include' : 'omit'
        });
        if (response.ok) {
          const { user, session } = await response.json();
          setUser(user);
          setSession(session);
          if (session.access_token) {
            localStorage.setItem('dev_token', session.access_token);
          }
          return { user, session };
        }
      } catch (backendError) {
        console.warn('Backend login failed, trying Supabase:', backendError.message);
      }
      
      // Fallback to Supabase
      try {
        const client = await initSupabase();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      } catch (err) {
        // Enhance network-related errors with clearer message so callers can surface helpful UI
        if (err instanceof TypeError || (err && typeof err.message === 'string' && err.message.toLowerCase().includes('failed to fetch'))) {
          const enriched = new Error('Network error: cannot reach Supabase auth endpoint. Check SUPABASE_URL and your network.');
          enriched.original = err;
          throw enriched;
        }
        throw err;
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, metadata = {}) => {
    try {
      setLoading(true);
      const client = await initSupabase();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Try backend logout
      try {
        const hasCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.length > 0);
        await fetchWithAuth('/api/auth/logout', {
          method: 'POST',
          credentials: hasCookie ? 'include' : 'omit'
        });
      } catch (error) {
        console.warn('Backend logout failed:', error.message);
      }
      
      // Supabase logout
      try {
        const client = await initSupabase();
        const { error } = await client.auth.signOut();
        if (error) {
          console.warn('Supabase logout failed:', error.message);
        }
      } catch (e) {
        console.warn('Supabase logout failed:', e?.message || e);
      }
      
      // Clear local state regardless of backend/Supabase results
      setUser(null);
      setSession(null);
      localStorage.removeItem('dev_token');
      
    } catch (error) {
      console.error('Error signing out:', error);
      // Clear state even if logout fails
      setUser(null);
      setSession(null);
      localStorage.removeItem('dev_token');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    try {
      const client = await initSupabase();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      const client = await initSupabase();
      const { error } = await client.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  };

  const updateProfile = async (updates) => {
    try {
      const client = await initSupabase();
      const { error } = await client.auth.updateUser({
        data: updates
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};