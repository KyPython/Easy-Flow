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

  // Build headers: do not add Content-Type for GET requests without a body
  const incomingHeaders = (options && options.headers) || {};
  const method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';
  const needsContentType = method !== 'GET' && method !== 'HEAD' && (options && ('body' in options));

  const headers = {
    ...incomingHeaders,
    ...(needsContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const mergedOptions = {
    // Default to omitting credentials to avoid sending cookies cross-origin in dev.
    // Call sites can still pass an explicit `credentials` option when needed.
    credentials: (options && 'credentials' in options) ? options.credentials : 'omit',
    ...options,
    headers
  };

  // Use safe fetch reference (support SSR/tests)
  const _fn = (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function')
    ? globalThis.fetch.bind(globalThis)
    : (typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null);

  if (!_fn) {
    console.warn('[devNetLogger] fetch() not available in this environment; aborting request');
    return Promise.reject(new Error('fetch not available'));
  }

  try {
    const res = await _fn(url, mergedOptions);

    // Dev diagnostic: mirror the same detection as the global fetch wrapper
    try {
      const acao = res.headers && typeof res.headers.get === 'function' ? res.headers.get('access-control-allow-origin') : null;
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
        }
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('devNetLogger:corsCookieWarning', { detail: { url, status: res.status } }));
          }
        } catch (e) {}
      }
    } catch (e) { /* diagnostic non-fatal */ }

    return res;
  } catch (err) {
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
              // Nothing we can do safely — attach a no-op that preserves behavior
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
