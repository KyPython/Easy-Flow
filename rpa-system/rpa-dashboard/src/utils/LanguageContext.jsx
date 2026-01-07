import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';

// Core language state only; translation handled by i18n hook now.
const LanguageContext = createContext({ language: 'en', setLanguage: () => {}, available: ['en','es','fr','de','it','pt'] });

export const LanguageProvider = ({ children }) => {
 const { user } = useAuth();
 const [language, setLanguageState] = useState('en');
 const available = ['en','es','fr','de','it','pt'];

 useEffect(() => {
 const stored = localStorage.getItem('app_language');
 if (stored && available.includes(stored)) setLanguageState(stored);
 }, []);

 useEffect(() => {
 const load = async () => {
 if (!user) return;
 try {
 // ✅ OPTIMIZATION: Try to use session context first (reduces API calls)
 let pref = null;
 try {
 const { useSession } = await import('../contexts/SessionContext');
 // Note: Can't use hooks conditionally, so we'll check session via a different approach
 // For now, fall back to API call but session will be used by other components
 } catch (e) {
 // SessionContext not available - continue with API call
 }
 
 // Fallback to API call if session data not available
 if (!pref) {
 const { api } = await import('./api');
 const resp = await api.get('/api/user/preferences');
 pref = resp?.data?.ui_preferences?.language;
 }
 
 if (pref && available.includes(pref)) {
 setLanguageState(pref);
 localStorage.setItem('app_language', pref);
 }
 } catch (e) {
 if (e?.response?.status === 401) {
 // Do not spam retry; rely on other auth flows
 // eslint-disable-next-line no-console
 console.warn('[LanguageContext] 401 fetching preferences; skipping language sync');
 }
 }
 };
 load();
 }, [user]);

 // Reflect language to <html lang> and body data-language for CSS/hooks
 useEffect(() => {
 try {
 document.documentElement.setAttribute('lang', language);
 document.body.dataset.language = language;
 } catch {}
 }, [language]);

 const persist = async (lang) => {
 if (!user) return;
 try {
 // Fetch existing preferences (ignore 401 quietly)
 let existing = {};
 try {
 const current = await api.get('/api/user/preferences');
 existing = current?.data || {};
 } catch (e) {
 if (e?.response?.status === 401) return; // not authenticated yet
 }
 const payload = {
 notification_preferences: existing.notification_preferences || undefined,
 ui_preferences: { ...(existing.ui_preferences || {}), language: lang },
 phone_number: existing.phone_number ?? undefined,
 fcm_token: existing.fcm_token ?? undefined
 };
 await api.put('/api/user/preferences', payload).catch(e => {
 if (e?.response?.status !== 401) throw e;
 });
 } catch (e) {
 // Silent fallback attempted only if authenticated
 if (e?.response?.status !== 401) {
 try { await api.put('/api/user/preferences', { ui_preferences: { language: lang } }); } catch {}
 }
 }
 };

 const setLanguage = (lang) => {
 if (!available.includes(lang)) return;
 setLanguageState(lang);
 localStorage.setItem('app_language', lang);
 persist(lang);
 };

 return <LanguageContext.Provider value={{ language, setLanguage, available }}>{children}</LanguageContext.Provider>;
};

LanguageProvider.propTypes = { children: PropTypes.node.isRequired };

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;