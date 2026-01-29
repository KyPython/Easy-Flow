import { useEffect, useRef } from 'react';
import { createLogger } from '../utils/logger';
const logger = createLogger('ChatbotUChatbot');
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

 const mount = ensureMount();

 const runtimeEnv = (typeof window !== 'undefined' && window._env) ? window._env : {};
 const widgetId = runtimeEnv.REACT_APP_UCHAT_WIDGET_ID || process.env.REACT_APP_UCHAT_WIDGET_ID || '3cpyqxve97diqnsu';
 if (!widgetId || widgetId.includes('xxxx')) {
 logger.warn('[Chatbot] No valid widget ID configured (REACT_APP_UCHAT_WIDGET_ID). Skipping load.');
 return;
 }
 
 // TROUBLESHOOTING: If you see 404 errors for widget?flow_token=..., this means:
 // 1. The widget ID (currently: ${widgetId}) may be invalid or expired
 // 2. The domain (${window.location.hostname}) may not be configured in your uChat dashboard
 // 3. The widget may be disabled or deleted from your uChat account
 // 
 // TO FIX:
 // - Log into your uchat.com.au dashboard
 // - Verify widget ID '${widgetId}' exists and is active
 // - Check domain whitelist includes '${window.location.hostname}'
 // - Regenerate widget if necessary and update REACT_APP_UCHAT_WIDGET_ID
 logger.info('[Chatbot] Loading widget', { widgetId, domain: window.location.hostname });
 // Check if the script is already loaded (by id or src)
 if (document.getElementById('uchat-script') || document.querySelector('script[src*="uchat.com.au"]')) {
 // Verify widget mount exists if script is present
 ensureMount();
 return; // Script already exists, don't load again
 }
 const src = `https://www.uchat.com.au/js/widget/${widgetId}/float.js`;
 const script = document.createElement('script');
 script.async = true;
 script.defer = true;
 script.src = src;
 script.id = 'uchat-script';
 script.onload = () => {
 logger.info('[Chatbot] uChat script loaded');
 // Post-load verification after a short delay
 setTimeout(() => {
 const injected = document.querySelector('#uchat-widget');
 if (!injected) {
 logger.warn('[Chatbot] Script loaded but widget DOM not found. Possible domain mismatch or CSP frame restriction.');
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
 logger.error('[Chatbot] failed to load uChat script', e);
 };
 document.head.appendChild(script);

 // Mutation observer: some widgets recreate iframes; strip fullscreen each time
 const observer = new MutationObserver(() => {
 const iframe = mount.querySelector('iframe');
 if (iframe) {
 iframe.removeAttribute('allowfullscreen');
 const current = iframe.getAttribute('allow') || '';
 const perms = ['microphone', 'camera', 'geolocation', 'clipboard-read', 'clipboard-write'];
 iframe.setAttribute('allow', Array.from(new Set(current.split(';').map(s=>s.trim()).filter(Boolean).concat(perms))).join('; '));
 }
 });
 observer.observe(mount, { childList: true, subtree: true });
 mount.__uchatObserver = observer;
 logger.info('[Chatbot] Injecting uChat script', { src, widgetId, origin: window.location.origin });
 } catch (e) {
 logger.error('[Chatbot] unexpected error setting up script', e);
 }
 return () => {
 try {
 const existingScript = document.getElementById('uchat-script') || document.querySelector('script[src*="uchat.com.au"]');
 if (existingScript) existingScript.remove();
 const chatWidget = document.querySelector('#uchat-widget');
 if (chatWidget) chatWidget.remove();
 const container = containerRef.current;
 const mount = container?.querySelector('#uchat-widget');
 const obs = mount?.__uchatObserver;
		if (obs) {
			try { obs.disconnect(); } catch (err) {
				// avoid swallowing errors silently during cleanup
				// eslint-disable-next-line no-console
				logger.debug('[Chatbot] observer.disconnect failed', err);
			}
			delete mount.__uchatObserver;
		}
		} catch (e) {
			// Log cleanup errors for easier debugging in dev
			// eslint-disable-next-line no-console
			logger.debug('[Chatbot] cleanup error', e);
		};
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
