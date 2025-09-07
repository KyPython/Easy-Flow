import { useEffect } from 'react';
import styles from './Chatbot.module.css';

const Chatbot = () => {
  useEffect(() => {
    try {
      // Check if the script is already loaded
      if (document.querySelector('script[src*="uchat.com.au"]')) {
        return; // Script already exists, don't load again
      }
      const widgetId = '3cpyqxve97diqnsu';
      const src = `https://www.uchat.com.au/js/widget/${widgetId}/float.js`;
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = src;
      script.onload = () => {
        console.info('[Chatbot] uChat script loaded');
      };
      script.onerror = (e) => {
        console.error('[Chatbot] failed to load uChat script', e);
      };
      document.head.appendChild(script);
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