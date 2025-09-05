import { useEffect } from 'react';
import styles from './Chatbot.module.css';

const Chatbot = () => {
  useEffect(() => {
    // Check if the script is already loaded
    if (document.querySelector('script[src*="uchat.com.au"]')) {
      return; // Script already exists, don't load again
    }

    // Create and load the chatbot script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = 'https://www.uchat.com.au/js/widget/3cpyqxve97diqnsu/float.js';
    
    // Add script to document head
    document.head.appendChild(script);

    // Cleanup function to remove script when component unmounts
    return () => {
      const existingScript = document.querySelector('script[src*="uchat.com.au"]');
      if (existingScript) {
        existingScript.remove();
      }
      
      // Also remove any chatbot widget elements that might remain
      const chatWidget = document.querySelector('#uchat-widget');
      if (chatWidget) {
        chatWidget.remove();
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