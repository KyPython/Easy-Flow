/**
 * Auth context for EasyFlow mobile.
 * Uses backend /api/auth/login, /api/auth/session, /api/auth/logout.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAuthToken, getAuthToken } from '../api/apiClient';

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const isValidSession = (data) =>
  data?.user && typeof data.user.id === 'string' && typeof data.user.email === 'string';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data } = await api.get('/api/auth/session');
      if (isValidSession(data)) {
        setUser(data.user);
      } else {
        await setAuthToken(null);
        setUser(null);
      }
    } catch (e) {
      await setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      if (!data?.session?.access_token) throw new Error('No token returned');
      await setAuthToken(data.session.access_token);
      setUser(data.user);
      return { data, error: null };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed';
      return { data: null, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await api.post('/api/auth/logout').catch(() => {});
      await setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const value = { user, loading, signIn, signOut, refreshSession: restoreSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
