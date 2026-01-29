import { getEnvVariable } from './commonEnv';
import { createLogger } from './logger';

const logger = createLogger('analyticsGate');

export async function enableAnalyticsForUser(user) {
 try {
 if (!user || !user.id) return false;

 // Idempotent guard - exit early if already injected
 const gaId = getEnvVariable(['VITE_GA_MEASUREMENT_ID', 'REACT_APP_GA_MEASUREMENT_ID']);
 if (window && window.__GTM_INJECTED__ === gaId) {
 return true; // Already injected for this GA ID
 }

 // Lazy-load supabase helper and check subscription
 const sup = await import('./supabaseClient');
 // ensure initialization (will return stub if not configured)
 await sup.initSupabase();
 const paid = await sup.isUserPaid(user.id);
 if (!paid) return false;

 // Inject Google Analytics (gtag) dynamically if measurement id exists
 if (!gaId) return false;

 // Legacy check for backwards compatibility
 if (window && window.gtag && typeof window.gtag === 'function' && window._gtagInjectedFor === gaId) {
 return true;
 }

 const script = document.createElement('script');
 script.async = true;
 script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
 document.head.appendChild(script);

 window.dataLayer = window.dataLayer || [];
 window.gtag = function () { window.dataLayer.push(arguments); };
 window.gtag('js', new Date());
 try {
 window.gtag('config', gaId, { send_page_view: false });
 } catch (e) {
 // swallow
 }
 // Mark injected id to avoid duplicates
 window._gtagInjectedFor = gaId;
 window.__GTM_INJECTED__ = gaId;
 return true;
 } catch (e) {
 logger.warn('Failed to enable analytics', { error: e?.message || String(e) });
 return false;
 }
}
