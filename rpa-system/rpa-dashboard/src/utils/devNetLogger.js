/*
Dev Network Logger
- Logs failing POST requests with their URL and status, even when the browser collapses errors to "Fetch failed".
- Wraps window.fetch and XMLHttpRequest; complements axios interceptors.
- Loaded only in development from src/index.js.
*/

/* eslint-disable no-console */

import { isDevelopment, getApiBaseUrl, getBackendPort } from './commonEnv';
import { getAuthToken, clearAuthTokens } from './auth';

// Configuration constants - extracted magic numbers
const DEFAULT_LOG_SAMPLE_RATE = 10; // Sample 10% of logs
const DEFAULT_NETWORK_ERROR_STATUS = 503;
const DEFAULT_BACKEND_PORT = '3030';

// Log sampling configuration - reduce log volume in development
const LOG_SAMPLE_RATE = parseInt(localStorage.getItem('DEV_LOG_SAMPLE_RATE') || String(DEFAULT_LOG_SAMPLE_RATE), 10);
let logCounter = 0;

function shouldLog() {
	logCounter++;
	return logCounter % LOG_SAMPLE_RATE === 0;
}

// Export a fetch wrapper for consistent use in app (top-level)
export async function fetchWithAuth(url, options = {}) {
	// Normalize token retrieval: support several storage keys and guard against string 'null'/'undefined'
	const token = getAuthToken();

	// Build full URL: if url is relative, prepend API base URL
	let fullUrl = url;
	if (url && typeof url === 'string' && url.startsWith('/')) {
		const baseUrl = getApiBaseUrl();
		if (baseUrl) {
			// Remove trailing slash from baseUrl and leading slash from url to avoid double slashes
			fullUrl = `${baseUrl.replace(/\/$/, '')}${url}`;
		}
	}

	// Build headers: do not add Content-Type for GET requests without a body
	const incomingHeaders = (options && options.headers) || {};
	const method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';

	try {
		const res = await fetch(fullUrl, {
			...options,
			headers: {
				...incomingHeaders,
				...(token ? { 'Authorization': `Bearer ${token}` } : {})
			}
		});

		// Self-healing: if 401 Unauthorized, clear auth tokens (but DO NOT reload to prevent infinite loops)
		if (res.status === 401) {
			// Skip self-heal on auth endpoints to prevent infinite loops
				const isAuthEndpoint = url.includes('/auth/') || url.includes('/login') || url.includes('/session');
				if (!isAuthEndpoint) {
					console.warn('[devNetLogger] 401 Unauthorized detected. Clearing auth tokens.');
					try {
						clearAuthTokens();
						if (typeof window !== 'undefined') {
							window.dispatchEvent(new CustomEvent('devNetLogger:selfHealAuth'));
						}
					} catch (e) {
						console.error('[devNetLogger] Self-heal failed:', e);
					}
				}
		}

		// Dev diagnostic: detect responses that set cookies while CORS allows any origin
		try {
			const acao = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-origin') : null;
			const acc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-credentials') : null;
			const setCookie = res.headers && typeof res.headers.get === 'function' ? res.headers.get('set-cookie') : null;
			if ((setCookie) || (acao === '*' && acc !== 'true')) {
				if (shouldLog()) {
					const warn = {
						message: '[devNetLogger] Potential CORS cookie mismatch detected',
						url,
						status: res.status,
						accessControlAllowOrigin: acao,
						accessControlAllowCredentials: acc,
						setCookieHeader: !!setCookie
					};
					console.warn(warn.message, warn);
					if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
						try {
							window.dispatchEvent(new CustomEvent('devNetLogger:corsCookieWarning', { detail: { url, status: res.status } }));
						} catch (e) {
							// non-fatal: ignore dispatch errors
						}
					}
				}
			}
		} catch (e) {
			// non-fatal diagnostic failure
		}

		if (!res.ok && method.toUpperCase() === 'POST') {
			console.warn('[net] POST failed', { url, status: res.status, statusText: res.statusText });
		}
		return res;
	} catch (err) {
		// ✅ ENVIRONMENT-AWARE: Suppress expected network errors in dev
		const isNetworkSuspended = err.message?.includes('ERR_NETWORK_IO_SUSPENDED') || err.message?.includes('Failed to fetch');
		if (isNetworkSuspended && isDevelopment) {
			// Tab suspended errors are expected - don't throw, just log at debug level
			console.debug('[devNetLogger] Network request suspended (tab backgrounded - expected)', { url });
			// Return a mock response to prevent error propagation.
			// NOTE: Response status must be within [200, 599]; using 503 to indicate a temporary network condition.
			return new Response(JSON.stringify({ error: 'Network suspended' }), {
				status: DEFAULT_NETWORK_ERROR_STATUS,
				statusText: 'Network suspended (dev stub)',
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (method.toUpperCase() === 'POST') {
			console.warn('[net] POST fetch error', { url, message: err?.message || String(err) });
		}
		throw err;
	}
}

// ...existing code...
if (typeof window !== 'undefined') {
	try {
		// --- Wrap fetch ---
		const _origFetch = window.fetch?.bind(window);
		if (_origFetch) {
			window.fetch = async (...args) => {
				let url = '(unknown)';
				let method = 'GET';
				let input, init;
				try {
					[input, init] = args;
					if (input && typeof input === 'object' && 'url' in input) {
						url = input.url;
						method = input.method || method;
					} else if (typeof input === 'string') {
						url = input;
						method = (init && init.method) || method;
					}
				} catch (e) { console.debug('[devNetLogger] parse fetch args failed', e); }

				// Convert Headers object to plain object if needed (Headers doesn't spread correctly)
				let incomingHeaders = {};
				if (init && init.headers) {
					if (init.headers instanceof Headers) {
						// Headers object - iterate entries
						for (const [key, value] of init.headers.entries()) {
							incomingHeaders[key] = value;
						}
					} else {
						// Plain object or array - spread it
						incomingHeaders = { ...init.headers };
					}
				}

				// Only add Authorization from localStorage if not already present in incoming headers
				const hasAuth = incomingHeaders && (incomingHeaders['Authorization'] || incomingHeaders['authorization']);
				const token = !hasAuth ? (getAuthToken() || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY)) : null;

				const enhancedInit = {
					...init,
					// Do not include credentials by default to avoid CORS credential preflight failures.
					credentials: (init && 'credentials' in init) ? init.credentials : 'omit',
					headers: {
						'Content-Type': 'application/json',
						...incomingHeaders,
						...(token ? { 'Authorization': `Bearer ${token}` } : {})
					}
				};

				try {
					const res = await _origFetch(input, enhancedInit);

					// Self-healing: if 401 Unauthorized, clear auth tokens (but DO NOT reload to prevent infinite loops)
							if (res.status === 401) {
						// Skip self-heal on auth endpoints to prevent infinite loops
						const isAuthEndpoint = url.includes('/auth/') || url.includes('/login') || url.includes('/session');
								if (!isAuthEndpoint) {
									console.warn('[devNetLogger] 401 Unauthorized detected. Clearing auth tokens.');
									try {
										clearAuthTokens();
										if (typeof window !== 'undefined') {
											window.dispatchEvent(new CustomEvent('devNetLogger:selfHealAuth'));
										}
									} catch (e) {
										console.error('[devNetLogger] Self-heal failed:', e);
									}
								}
					}

					// Dev diagnostic: detect responses that set cookies while CORS allows any origin
					try {
						const acao = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-origin') : null;
						const acc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-credentials') : null;
						// Note: browsers usually do not expose 'set-cookie' to JS; presence is often detectable only server-side.
						// However some proxies/environments might echo a 'set-cookie' header into CORS-exposed headers.
						const setCookie = res.headers && typeof res.headers.get === 'function' ? res.headers.get('set-cookie') : null;

						if ((setCookie) || (acao === '*' && acc !== 'true')) {
							const warn = {
								message: '[devNetLogger] Potential CORS cookie mismatch detected',
								url,
								status: res.status,
								accessControlAllowOrigin: acao,
								accessControlAllowCredentials: acc,
								setCookieHeader: !!setCookie
							};
							// Console warning so capture-trace / diagnose scripts will pick this up in diagnostics
							console.warn(warn.message, warn);

							// Broadcast an in-window event so dev tooling can capture it programmatically
							try {
								if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
									window.dispatchEvent(new CustomEvent('devNetLogger:corsCookieWarning', { detail: warn }));
								}
							} catch (e) {
								// ignore
							}
						}
					} catch (e) {
						// non-fatal diagnostic failure
					}

					if (!res.ok && method.toUpperCase() === 'POST') {
						console.warn('[net] POST failed', { url, status: res.status, statusText: res.statusText });
					}
					return res;
				} catch (err) {
					if (method.toUpperCase() === 'POST') {
						console.warn('[net] POST fetch error', { url, message: err?.message || String(err) });
					}
					throw err;
				}
			};
		}

		// --- Wrap XMLHttpRequest ---
		const _OrigXHR = window.XMLHttpRequest;
		try {
			// Only attempt to wrap if the original XHR and its prototype.open are real functions
			if (_OrigXHR && typeof _OrigXHR.prototype?.open === 'function') {
				const WrappedXHR = function() {
					const xhr = new _OrigXHR();
					let _url = '(unknown)';
					let _method = 'GET';

					const origOpen = xhr.open;
					if (typeof origOpen === 'function') {
						xhr.open = function(method, url, ...rest) {
							try {
								_method = String(method || 'GET');
								_url = String(url || '(unknown)');
							} catch (e) { console.debug('[devNetLogger] parse xhr open args failed', e); }
							return origOpen.apply(xhr, [method, url, ...rest]);
						};
					} else {
						// Defensive: if open isn't a function on the instance, fall back to prototype implementation if available
						const protoOpen = _OrigXHR.prototype && _OrigXHR.prototype.open;
						if (typeof protoOpen === 'function') {
							xhr.open = function(method, url, ...rest) {
								try {
									_method = String(method || 'GET');
									_url = String(url || '(unknown)');
								} catch (e) { console.debug('[devNetLogger] parse proto open args failed', e); }
								return protoOpen.apply(xhr, [method, url, ...rest]);
							};
						} else {
							// Nothing we can do safely -- attach a no-op that preserves behavior
							xhr.open = function() {
								try { console.warn('[devNetLogger] XHR open not available to wrap; skipping instrumentation for this instance.'); } catch (e) { console.debug('[devNetLogger] xhr open noop failed', e); }
							};
						}
					}

					try {
						xhr.addEventListener('error', () => {
							try {
								if (_method.toUpperCase() === 'POST') {
									console.warn('[net] POST XHR error', { url: _url, status: xhr.status });
								}
							} catch (e) { console.debug('[devNetLogger] xhr error handler failed', e); }
						});
						xhr.addEventListener('loadend', () => {
							try {
								if (_method.toUpperCase() === 'POST' && (xhr.status === 0 || xhr.status >= 400)) {
									console.warn('[net] POST XHR failed', { url: _url, status: xhr.status });
								}
							} catch (e) { console.debug('[devNetLogger] xhr loadend handler failed', e); }
						});
					} catch (e) {
						console.debug('[devNetLogger] adding xhr listeners failed', e);
					}

					return xhr;
				};

				// Preserve readyState constants if present
				try {
					WrappedXHR.UNSENT = _OrigXHR.UNSENT;
					WrappedXHR.OPENED = _OrigXHR.OPENED;
					WrappedXHR.HEADERS_RECEIVED = _OrigXHR.HEADERS_RECEIVED;
					WrappedXHR.LOADING = _OrigXHR.LOADING;
					WrappedXHR.DONE = _OrigXHR.DONE;
				} catch (e) { console.debug('[devNetLogger] preserve readyState constants failed', e); }

				// Replace global XHR
				window.XMLHttpRequest = WrappedXHR;
			} else {
				console.warn('[devNetLogger] Skipping XHR wrapping - XMLHttpRequest or its open() is not a function in this environment.');
			}
		} catch (e) {
			console.debug('[devNetLogger] XHR wrap initialization failed', e);
		}
	} catch (e) {
		console.debug('[devNetLogger] init failed', e);
	}
}

export {}; // module marker
