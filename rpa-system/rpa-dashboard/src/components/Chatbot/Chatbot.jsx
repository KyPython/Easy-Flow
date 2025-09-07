import { useEffect } from 'react';
import styles from './Chatbot.module.css';

const Chatbot = () => {
  useEffect(() => {
    try {
      const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
      const widgetId = runtimeEnv.REACT_APP_UCHAT_WIDGET_ID || process.env.REACT_APP_UCHAT_WIDGET_ID || '3cpyqxve97diqnsu';
      if (!widgetId || widgetId.includes('xxxx')) {
        console.warn('[Chatbot] No valid widget ID configured (REACT_APP_UCHAT_WIDGET_ID). Skipping load.');
        return;
      }
      // Check if the script is already loaded
      if (document.querySelector('script[src*="uchat.com.au"]')) {
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
    <div className={styles.chatbotContainer}>
      {/* The chatbot widget will be injected by the script */}
    </div>
  );
};

export default Chatbot;