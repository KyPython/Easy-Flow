/*
Dev Network Logger
- Logs failing POST requests with their URL and status, even when the browser collapses errors to "Fetch failed".
- Wraps window.fetch and XMLHttpRequest; complements axios interceptors.
- Loaded only in development from src/index.js.
*/

/* eslint-disable no-console */

// Log sampling configuration - reduce log volume in development
const LOG_SAMPLE_RATE = parseInt(localStorage.getItem('DEV_LOG_SAMPLE_RATE') || '10', 10); // Sample 10% of logs
let logCounter = 0;

function shouldLog() {
 logCounter++;
 return logCounter % LOG_SAMPLE_RATE === 0;
}

// Helper to get API base URL (same logic as config.js)
function getApiBaseUrl() {
 // Check for explicit env vars first
 if (typeof window !== 'undefined' && window._env) {
 if (window._env.VITE_API_URL) return window._env.VITE_API_URL;
 if (window._env.VITE_API_BASE) return window._env.VITE_API_BASE;
 if (window._env.REACT_APP_API_BASE) return window._env.REACT_APP_API_BASE;
 }
 
 // Check process.env (build-time)
 if (typeof process !== 'undefined' && process.env) {
 if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
 if (process.env.REACT_APP_API_BASE) return process.env.REACT_APP_API_BASE;
 if (process.env.VITE_API_BASE) return process.env.VITE_API_BASE;
 }
 
 // Auto-detect based on hostname (only if env vars are not set)
 if (typeof window !== 'undefined') {
 const hostname = window.location.hostname;
 
 // Development environments - use configured port
 if (hostname === 'localhost' || hostname === '127.0.0.1') {
 const backendPort = (typeof window !== 'undefined' && window._env?.VITE_BACKEND_PORT) ||
 (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_PORT) ||
 '3030';
 return `http://${hostname}:${backendPort}`;
 }
 
 // Production environments - use same origin (no hardcoded domains)
 // All production URLs should be configured via VITE_API_URL env var
 return window.location.origin;
 }
 
 // Fallback: empty string (relative URLs will work with proxy)
 return '';
}

// Export a fetch wrapper for consistent use in app (top-level)
export async function fetchWithAuth(url, options = {}) {
 // Normalize token retrieval: support several storage keys and guard against string 'null'/'undefined'
 let rawToken = null;
 try {
 rawToken = localStorage.getItem('dev_token') || localStorage.getItem('authToken') || localStorage.getItem('token');
 } catch (e) {
 // localStorage may be unavailable in some environments (SSR/tests)
 rawToken = null;
 }
 const token = (rawToken && rawToken !== 'undefined' && rawToken !== 'null') ? rawToken : null;

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
			const acao = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-origin') : null;
			const acc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-credentials') : null;
			const setCookie = res.headers && typeof res.headers.get === 'function' ? res.headers.get('set-cookie') : null;
			if ((setCookie) || (acao === '*' && acc !== 'true')) {
				// Only log CORS warnings occasionally to reduce noise
				if (shouldLog()) {
					try {
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
							window.dispatchEvent(new CustomEvent('devNetLogger:corsCookieWarning', { detail: { url, status: res.status } }));
						}
						// diagnostic non-fatal
						// (removed stray catch block)
				}
			}
			// ✅ ENVIRONMENT-AWARE: Suppress expected network errors in dev
			const isNetworkSuspended = err.message?.includes('ERR_NETWORK_IO_SUSPENDED') || err.message?.includes('Failed to fetch');
			if (isNetworkSuspended && isDevelopment) {
				// Tab suspended errors are expected - don't throw, just log at debug level
				console.debug('[devNetLogger] Network request suspended (tab backgrounded - expected)', { url });
				// Return a mock response to prevent error propagation
				return new Response(JSON.stringify({ error: 'Network suspended' }), { 
					status: 0, 
					statusText: 'Network suspended',
					headers: { 'Content-Type': 'application/json' }
				});
			}
			throw err;
		}
		// diagnostic non-fatal
 const acc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-credentials') : null;
 const setCookie = res.headers && typeof res.headers.get === 'function' ? res.headers.get('set-cookie') : null;
 if ((setCookie) || (acao === '*' && acc !== 'true')) {
 // Only log CORS warnings occasionally to reduce noise
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
		// diagnostic non-fatal
	} catch (err) {
 // ✅ ENVIRONMENT-AWARE: Suppress expected network errors in dev
 const isNetworkSuspended = err.message?.includes('ERR_NETWORK_IO_SUSPENDED') || err.message?.includes('Failed to fetch');
 if (isNetworkSuspended && isDevelopment) {
 // Tab suspended errors are expected - don't throw, just log at debug level
 console.debug('[devNetLogger] Network request suspended (tab backgrounded - expected)', { url });
 // Return a mock response to prevent error propagation
 return new Response(JSON.stringify({ error: 'Network suspended' }), { 
 status: 0, 
 statusText: 'Network suspended',
 headers: { 'Content-Type': 'application/json' }
 });
 }
 throw err;
 }
}
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
 } catch {}

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
 const token = !hasAuth ? (localStorage.getItem('dev_token') || localStorage.getItem('authToken') || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY)) : null;

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

		// Self-healing: if 401 Unauthorized, clear cookies/localStorage and trigger re-authentication
		if (res.status === 401) {
			console.warn('[devNetLogger] 401 Unauthorized detected. Attempting self-heal: clearing auth tokens and cookies, triggering re-authentication.');
			try {
				// Clear localStorage tokens
				localStorage.removeItem('dev_token');
				localStorage.removeItem('authToken');
				// Attempt to clear cookies (best effort)
				if (typeof document !== 'undefined') {
					document.cookie.split(';').forEach(function(c) {
						document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
					});
				}
				// Optionally, trigger a login flow or reload
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('devNetLogger:selfHealAuth'));
					setTimeout(function() { window.location.reload(); }, 1000);
				}
			} catch (e) {
				console.error('[devNetLogger] Self-heal failed:', e);
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
 function WrappedXHR() {
 const xhr = new _OrigXHR();
 let _url = '(unknown)';
 let _method = 'GET';

 const origOpen = xhr.open;
 if (typeof origOpen === 'function') {
 xhr.open = function(method, url, ...rest) {
 try {
 _method = String(method || 'GET');
 _url = String(url || '(unknown)');
 } catch {}
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
 } catch {}
 return protoOpen.apply(xhr, [method, url, ...rest]);
 };
 } else {
 // Nothing we can do safely -- attach a no-op that preserves behavior
 xhr.open = function() {
 try { console.warn('[devNetLogger] XHR open not available to wrap; skipping instrumentation for this instance.'); } catch (e) {}
 };
 }
 }

 try {
 xhr.addEventListener('error', () => {
 try {
 if (_method.toUpperCase() === 'POST') {
 console.warn('[net] POST XHR error', { url: _url, status: xhr.status });
 }
 } catch (e) { /* ignore */ }
 });
 xhr.addEventListener('loadend', () => {
 try {
 if (_method.toUpperCase() === 'POST' && (xhr.status === 0 || xhr.status >= 400)) {
 console.warn('[net] POST XHR failed', { url: _url, status: xhr.status });
 }
 } catch (e) { /* ignore */ }
 });
 } catch (e) {
 // If adding listeners fails, just return the raw xhr
 }

 return xhr;
 }

 // Preserve readyState constants if present
 try {
 WrappedXHR.UNSENT = _OrigXHR.UNSENT;
 WrappedXHR.OPENED = _OrigXHR.OPENED;
 WrappedXHR.HEADERS_RECEIVED = _OrigXHR.HEADERS_RECEIVED;
 WrappedXHR.LOADING = _OrigXHR.LOADING;
 WrappedXHR.DONE = _OrigXHR.DONE;
 } catch (e) { /* ignore */ }

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
