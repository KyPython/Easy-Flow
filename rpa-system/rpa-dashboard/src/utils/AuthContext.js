import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from './supabaseClient';

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
  const checkBackendAuth = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        if (sessionData.user) {
          setUser(sessionData.user);
          setSession(sessionData);
          return true;
        }
      }
    } catch (error) {
      console.log('Backend auth not available, trying Supabase...');
    }
    return false;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try backend authentication first
        const backendAuth = await checkBackendAuth();
        
        if (!backendAuth) {
          // Fall back to Supabase if backend auth fails
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
              console.warn('Supabase auth error:', error.message);
              // Don't throw - continue with no authentication
            } else {
              setSession(session);
              setUser(session?.user ?? null);
            }
          } catch (supabaseError) {
            console.warn('Supabase not available:', supabaseError.message);
            // Continue without authentication - user can still use public features
          }
        }
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
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include'
        });
        
        if (response.ok) {
          const { user, session } = await response.json();
          setUser(user);
          setSession(session);
          
          // Store token for API requests
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
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
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