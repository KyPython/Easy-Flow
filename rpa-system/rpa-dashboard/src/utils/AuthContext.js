/* eslint-disable react-hooks/exhaustive-deps */

import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import supabase, { initSupabase } from './supabaseClient';
import { fetchWithAuth } from './devNetLogger';
import { createLogger } from './logger';

const AuthContext = createContext();

const isValidSession = (session) => {
	if (!session) return false;
	const user = session.user || session;
	return !!(user && typeof user.id === 'string' && user.id.length > 0 && typeof user.email === 'string' && user.email.length > 0);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) throw new Error('useAuth must be used within an AuthProvider');
	return context;
};

export const AuthProvider = ({ children }) => {
	const isDevelopment = process.env.NODE_ENV === 'development';
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [session, setSession] = useState(null);
	const logger = createLogger('Auth');

	const checkBackendAuth = async (explicitToken = null) => {
		try {
			let token = explicitToken;
			if (!token) {
				try {
					token = localStorage.getItem('dev_token') || localStorage.getItem('authToken') || localStorage.getItem('token');
				} catch (e) {
					token = null;
				}
				if (token === 'undefined' || token === 'null') token = null;
			}

			const hasCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.length > 0);
			if (!token && !hasCookie) {
				logger.debug('No token or cookies found; skipping backend /api/auth/session call.');
				return false;
			}

			const response = await fetchWithAuth('/api/auth/session', { credentials: hasCookie ? 'include' : 'omit' });
			const contentType = response.headers.get('content-type') || '';
			const isJson = contentType.includes('application/json');

			if (response.status === 401) {
				logger.info('Backend returned 401, clearing session');
				setUser(null);
				setSession(null);
				localStorage.removeItem('dev_token');
				return false;
			}

			if (!isJson) {
				const errorText = await response.text();
				logger.error('Backend returned non-JSON response', {
					status: response.status,
					statusText: response.statusText,
					contentType,
					bodyPreview: errorText.substring(0, 200),
					url: '/api/auth/session'
				});
				throw new Error(`Backend returned ${response.status} ${response.statusText} with content-type ${contentType}.`);
			}

					if (response.ok) {
				const sessionData = await response.json();
				if (isValidSession(sessionData)) {
					setUser(sessionData.user);
					setSession(sessionData);
					return true;
				}
				setUser(null);
				setSession(null);
				try { localStorage.removeItem('dev_token'); } catch (e) { logger.debug('Failed to remove dev_token when clearing invalid session', { e: e?.message || e }); }
				logger.warn('Session data invalid, clearing user/session');
				return false;
			}

			const errorData = await response.json().catch(() => ({}));
			logger.warn('Backend session check returned error', { status: response.status, statusText: response.statusText, error: errorData });
			setUser(null);
			setSession(null);
			localStorage.removeItem('dev_token');
			return false;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			if (errorMessage.includes('JSON')) {
				logger.error('Backend session check failed - received HTML instead of JSON.', err);
			} else {
				logger.warn('Backend session check failed (network error)', { error: errorMessage, isDev: isDevelopment });
			}
			logger.debug('Preserving existing session state due to network error');
			return false;
		}
	};

	useEffect(() => {
		let subscription = null;

		const initializeAuth = async () => {
			logger.info('Initializing authentication...');
			try {
				try {
					await initSupabase();
				} catch (e) {
					logger.warn('Supabase init failed, continuing with stub', { error: e?.message || e });
				}

				try {
					const client = await initSupabase();
					const { data: { session: sbSession }, error } = await client.auth.getSession();
					if (!error && sbSession && isValidSession(sbSession)) {
						logger.debug('Found existing Supabase session', { email: sbSession.user?.email });
						if (sbSession.access_token) {
							try { localStorage.setItem('dev_token', sbSession.access_token); } catch (e) { logger.debug('Failed to persist dev_token', { e: e?.message || e }); }
						}
						setSession(sbSession);
						setUser(sbSession.user ?? null);
					} else if (error) {
						logger.warn('Supabase getSession error', { error: error?.message || error });
					} else {
						logger.debug('No existing Supabase session found');
					}
				} catch (supabaseError) {
					logger.warn('Supabase not available', { error: supabaseError?.message || supabaseError });
				}

				let startupToken = null;
				try { startupToken = localStorage.getItem('dev_token') || localStorage.getItem('authToken') || localStorage.getItem('token'); } catch (e) { startupToken = null; }
				if (startupToken === 'undefined' || startupToken === 'null') startupToken = null;

				// Dev bypass for local development
				try {
					const isDev = process.env.NODE_ENV === 'development';
					const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
					const allowed = ['kyjahntsmith@gmail.com', 'kyjahnsmith36@gmail.com'];
					const lastEmail = (typeof localStorage !== 'undefined') ? (localStorage.getItem('last_login_email') || '') : '';
					if (isDev && isLocal && !user && !session && allowed.includes(lastEmail)) {
						const mockUser = { id: '00000000-0000-0000-0000-000000000001', email: lastEmail };
						setUser(mockUser);
						setSession({ user: mockUser, access_token: null });
						logger.info('Dev bypass applied for local run', { email: lastEmail });
					}
				} catch (e) { logger.debug('Dev bypass check failed', { e: e?.message || e }); }

				await checkBackendAuth(startupToken);
				logger.debug('Initialization complete', { email: user?.email || 'none' });
			} catch (error) {
				logger.error('Initialization error', { error });
			} finally {
				setLoading(false);
			}

			// Attach Supabase auth state listener
			try {
				const client = await initSupabase();
				const res = client.auth.onAuthStateChange((event, nextSession) => {
					if (event === 'INITIAL_SESSION') return;
					logger.debug('Auth state changed', { event, email: nextSession?.user?.email || 'no user' });
					if (isValidSession(nextSession)) {
						setSession(nextSession);
						setUser(nextSession.user ?? null);
					} else {
						setUser(null);
						setSession(null);
						try { localStorage.removeItem('dev_token'); } catch (e) { logger.debug('Failed to remove dev_token on auth change', { e: e?.message || e }); }
					}
					setLoading(false);
				});
				subscription = (res && res.data && res.data.subscription) ? res.data.subscription : null;
			} catch (err) {
				logger.warn('Could not set up auth listener', { error: err?.message || err });
			}
		};

		initializeAuth();

		return () => {
				try { if (subscription) subscription.unsubscribe(); } catch (e) { logger.debug('Failed to unsubscribe auth listener', { e: e?.message || e }); }
		};
	}, []);

	const signIn = async (email, password) => {
		try {
			setLoading(true);

			// Try backend login first
			try {
				const hasCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.length > 0);
				const loginUrl = '/api/auth/login';
				logger.debug('Attempting backend login', { url: loginUrl, email: email ? email.substring(0, 3) + '***' : 'missing', hasCookie });
				const response = await fetchWithAuth(loginUrl, { method: 'POST', body: JSON.stringify({ email, password }), credentials: hasCookie ? 'include' : 'omit' });
				logger.debug('Backend login response', { status: response.status, ok: response.ok, url: response.url });
					if (response.ok) {
					const { user: backendUser, session: backendSession } = await response.json();
					setUser(backendUser);
					setSession(backendSession);
					if (backendSession?.access_token) {
						try { localStorage.setItem('dev_token', backendSession.access_token); } catch (e) { logger.debug('Failed to persist backend dev_token', { e: e?.message || e }); }
						try { if (email) localStorage.setItem('last_login_email', email); } catch (e) { logger.debug('Failed to persist last_login_email', { e: e?.message || e }); }
					}
					if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('just_signed_up_pending') === 'true') {
						sessionStorage.setItem('just_signed_up', 'true');
						sessionStorage.removeItem('just_signed_up_pending');
					}
					return { data: { user: backendUser, session: backendSession }, error: null };
				}
				const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
				const backendError = new Error(errorData.error || `Login failed with status ${response.status}`);
				backendError.status = response.status;
				throw backendError;
			} catch (backendError) {
				logger.warn('Backend login failed, trying Supabase fallback', { message: backendError.message, status: backendError.status });
				const isNetworkError = backendError instanceof TypeError || backendError.message?.includes('Failed to fetch') || backendError.message?.includes('NetworkError');
				if (!isNetworkError && backendError.status !== 401) throw backendError;
			}

			// Fallback to Supabase
			try {
				const client = await initSupabase();
				const { data, error } = await client.auth.signInWithPassword({ email, password });
				if (error) {
					const enhancedError = new Error(error.message || 'Supabase authentication failed');
					enhancedError.status = error.status || 401;
					enhancedError.original = error;
					throw enhancedError;
				}
				if (data?.user) {
					setUser(data.user);
					setSession(data.session);
					if (data.session?.access_token) {
						try { localStorage.setItem('dev_token', data.session.access_token); } catch (e) { logger.debug('Failed to persist supabase dev_token', { e: e?.message || e }); }
						try { if (email) localStorage.setItem('last_login_email', email); } catch (e) { logger.debug('Failed to persist last_login_email', { e: e?.message || e }); }
					}
					if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('just_signed_up_pending') === 'true') {
						sessionStorage.setItem('just_signed_up', 'true');
						sessionStorage.removeItem('just_signed_up_pending');
					}
				}
				return { data, error: null };
			} catch (err) {
				if (err instanceof TypeError || (err && typeof err.message === 'string' && err.message.toLowerCase().includes('failed to fetch'))) {
					const enriched = new Error('Network error: cannot reach Supabase auth endpoint. Check SUPABASE_URL and your network.');
					enriched.original = err;
					enriched.status = 0;
					throw enriched;
				}
				throw err;
			}
		} catch (error) {
			logger.error('Error signing in', { message: error?.message, status: error?.status });
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const signUp = async (email, password, metadata = {}) => {
		try {
			setLoading(true);
			const client = await initSupabase();
			const { data, error } = await client.auth.signUp({ email, password, options: { data: metadata } });
			if (error) throw error;
			return data;
		} catch (error) {
			logger.error('Error signing up', { error });
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const signOut = async () => {
		try {
			setLoading(true);
			try {
				const hasCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.length > 0);
				await fetchWithAuth('/api/auth/logout', { method: 'POST', credentials: hasCookie ? 'include' : 'omit' });
			} catch (error) {
				logger.warn('Backend logout failed', { error: error?.message || error });
			}
			try {
				const client = await initSupabase();
				const { error } = await client.auth.signOut();
				if (error) logger.warn('Supabase logout failed', { error: error?.message || error });
			} catch (e) {
				logger.warn('Supabase logout failed', { error: e?.message || e });
			}
			setUser(null);
			setSession(null);
			try { localStorage.removeItem('dev_token'); } catch (e) { logger.debug('Failed to remove dev_token during signOut', { e: e?.message || e }); }
		} catch (error) {
			logger.error('Error signing out', { error });
			setUser(null);
			setSession(null);
			try { localStorage.removeItem('dev_token'); } catch (e) { logger.debug('Failed to remove dev_token during signOut error path', { e: e?.message || e }); }
		} finally {
			setLoading(false);
		}
	};

	const resetPassword = async (email) => {
		try {
			const client = await initSupabase();
			const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
			if (error) throw error;
		} catch (error) {
			logger.error('Error resetting password', { error });
			throw error;
		}
	};

	const updatePassword = async (newPassword) => {
		try {
			const client = await initSupabase();
			const { error } = await client.auth.updateUser({ password: newPassword });
			if (error) throw error;
		} catch (error) {
			logger.error('Error updating password', { error });
			throw error;
		}
	};

	const updateProfile = async (updates) => {
		try {
			const client = await initSupabase();
			const { error } = await client.auth.updateUser({ data: updates });
			if (error) throw error;
		} catch (error) {
			logger.error('Error updating profile', { error });
			throw error;
		}
	};

	const value = { user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword, updateProfile };

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
};

AuthProvider.propTypes = { children: PropTypes.node.isRequired };