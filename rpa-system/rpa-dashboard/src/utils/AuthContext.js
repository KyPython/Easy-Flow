import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from './supabaseClient';
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

      // Provide Authorization header if token present; fetchWithAuth also sends cookies via credentials: 'include'
      const response = await fetchWithAuth('/api/auth/session');
      if (response.status === 401) {
        setUser(null);
        setSession(null);
        localStorage.removeItem('dev_token');
        return false;
      }
      if (response.ok) {
        const sessionData = await response.json();
        if (sessionData.user) {
          setUser(sessionData.user);
          setSession(sessionData);
          return true;
        }
      }
    } catch (error) {
      // Gracefully handle network/backend errors
      setUser(null);
      setSession(null);
      localStorage.removeItem('dev_token');
    }
    return false;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Prefer Supabase client-side session if available so we can forward its token to backend
        try {
          const { data: { session: sbSession }, error } = await supabase.auth.getSession();
          if (!error && sbSession) {
            // Store token so fetchWithAuth will include Authorization header
            if (sbSession.access_token) {
              try { localStorage.setItem('dev_token', sbSession.access_token); } catch (e) {}
            }
            setSession(sbSession);
            setUser(sbSession?.user ?? null);
          }
        } catch (supabaseError) {
          console.warn('Supabase not available:', supabaseError.message);
        }

        // Ensure token is read from storage (or session) and passed explicitly to avoid races
        let startupToken = null;
        try { startupToken = localStorage.getItem('dev_token') || localStorage.getItem('authToken') || localStorage.getItem('token'); } catch (e) { startupToken = null; }
        if (startupToken === 'undefined' || startupToken === 'null') startupToken = null;

        // Then try backend auth (will accept Authorization header or cookie if present)
        await checkBackendAuth(startupToken);
      } catch (error) {
        console.error('Authentication initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up Supabase auth listener (only if Supabase is available)
    let subscription = null;
    try {
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
        if (event === 'INITIAL_SESSION') return;
        console.log('Auth state changed:', event, nextSession?.user?.email || 'no user');
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      });
      subscription = authSubscription;
    } catch (error) {
      console.warn('Could not set up auth listener:', error.message);
    }

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
        const response = await fetchWithAuth('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.auth.signUp({
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
        await fetchWithAuth('/api/auth/logout', {
          method: 'POST'
        });
      } catch (error) {
        console.warn('Backend logout failed:', error.message);
      }
      
      // Supabase logout
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase logout failed:', error.message);
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
      const { error } = await supabase.auth.updateUser({
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
      const { error } = await supabase.auth.updateUser({
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