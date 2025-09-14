/*
 Dev Network Logger
 - Logs failing POST requests with their URL and status, even when the browser collapses errors to "Fetch failed".
 - Wraps window.fetch and XMLHttpRequest; complements axios interceptors.
 - Loaded only in development from src/index.js.
 */

/* eslint-disable no-console */

if (typeof window !== 'undefined') {
  try {
    // --- Wrap fetch ---
    const _origFetch = window.fetch?.bind(window);
    if (_origFetch) {
      window.fetch = async (...args) => {
        let url = '(unknown)';
        let method = 'GET';
        try {
          const [input, init] = args;
          if (input && typeof input === 'object' && 'url' in input) {
            url = input.url;
            method = input.method || method;
          } else if (typeof input === 'string') {
            url = input;
            method = (init && init.method) || method;
          }
        } catch {}

        try {
          const res = await _origFetch(...args);
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
    if (_OrigXHR) {
      function WrappedXHR() {
        const xhr = new _OrigXHR();
        let _url = '(unknown)';
        let _method = 'GET';

        const origOpen = xhr.open;
        xhr.open = function(method, url, ...rest) {
          try {
            _method = String(method || 'GET');
            _url = String(url || '(unknown)');
          } catch {}
          return origOpen.apply(xhr, [method, url, ...rest]);
        };

        xhr.addEventListener('error', () => {
          if (_method.toUpperCase() === 'POST') {
            console.warn('[net] POST XHR error', { url: _url, status: xhr.status });
          }
        });
        xhr.addEventListener('loadend', () => {
          if (_method.toUpperCase() === 'POST' && (xhr.status === 0 || xhr.status >= 400)) {
            console.warn('[net] POST XHR failed', { url: _url, status: xhr.status });
          }
        });

        return xhr;
      }
      WrappedXHR.UNSENT = _OrigXHR.UNSENT;
      WrappedXHR.OPENED = _OrigXHR.OPENED;
      WrappedXHR.HEADERS_RECEIVED = _OrigXHR.HEADERS_RECEIVED;
      WrappedXHR.LOADING = _OrigXHR.LOADING;
      WrappedXHR.DONE = _OrigXHR.DONE;

      // Replace global XHR
      window.XMLHttpRequest = WrappedXHR;
    }
  } catch (e) {
    console.debug('[devNetLogger] init failed', e);
  }
}

export {}; // module marker
