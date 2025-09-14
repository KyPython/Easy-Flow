import { useEffect, useRef } from 'react';
import styles from './Chatbot.module.css';

const Chatbot = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    try {
      // Ensure our target mount exists before loading the script
      // Some widgets expect a specific element to attach to (e.g., #uchat-widget).
      // We create it inside our component container to avoid global timing issues.
      const ensureMount = () => {
        const container = containerRef.current || document.body;
        let mount = document.getElementById('uchat-widget');
        if (!mount) {
          mount = document.createElement('div');
          mount.id = 'uchat-widget';
          container.appendChild(mount);
        }
        return mount;
      };

      ensureMount();

      const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
      const widgetId = runtimeEnv.REACT_APP_UCHAT_WIDGET_ID || process.env.REACT_APP_UCHAT_WIDGET_ID || '3cpyqxve97diqnsu';
      if (!widgetId || widgetId.includes('xxxx')) {
        console.warn('[Chatbot] No valid widget ID configured (REACT_APP_UCHAT_WIDGET_ID). Skipping load.');
        return;
      }
      // Check if the script is already loaded
      if (document.querySelector('script[src*="uchat.com.au"]')) {
        // Verify widget mount exists if script is present
        ensureMount();
        return; // Script already exists, don't load again
      }
      const src = `https://www.uchat.com.au/js/widget/${widgetId}/float.js`;
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = src;
      script.onload = () => {
        console.info('[Chatbot] uChat script loaded');
        // Post-load verification after a short delay
        setTimeout(() => {
          const injected = document.querySelector('#uchat-widget');
            if (!injected) {
              console.warn('[Chatbot] Script loaded but widget DOM not found. Possible domain mismatch or CSP frame restriction.');
            } else {
              // If iframe exists, ensure it does not request fullscreen permission to avoid policy violations
              const iframe = injected.querySelector('iframe');
              if (iframe) {
                // Remove legacy attributes the widget might add
                iframe.removeAttribute('allowfullscreen');
                // Provide a safe allow list without fullscreen
                const current = iframe.getAttribute('allow') || '';
                const perms = ['microphone', 'camera', 'geolocation', 'clipboard-read', 'clipboard-write'];
                iframe.setAttribute('allow', Array.from(new Set(current.split(';').map(s=>s.trim()).filter(Boolean).concat(perms))).join('; '));
              }
            }
        }, 1500);
      };
      script.onerror = (e) => {
        console.error('[Chatbot] failed to load uChat script', e);
      };
      document.head.appendChild(script);
      console.info('[Chatbot] Injecting uChat script', { src, widgetId, origin: window.location.origin });
    } catch (e) {
      console.error('[Chatbot] unexpected error setting up script', e);
    }
    return () => {
      try {
        const existingScript = document.querySelector('script[src*="uchat.com.au"]');
        if (existingScript) existingScript.remove();
        const chatWidget = document.querySelector('#uchat-widget');
        if (chatWidget) chatWidget.remove();
      } catch (e) {
        // swallow cleanup errors
      }
    };
  }, []);

  return (
    <div className={styles.chatbotContainer} ref={containerRef}>
      {/* The chatbot widget will be injected by the script into #uchat-widget.
          If the widget still fails to render, it may be due to Content Security Policy (CSP)
          or cross-origin frame restrictions on your domain/environment. In that case,
          you might need to update server-side headers (e.g., script-src / frame-ancestors)
          to allow https://www.uchat.com.au. */}
    </div>
  );
};

export default Chatbot;