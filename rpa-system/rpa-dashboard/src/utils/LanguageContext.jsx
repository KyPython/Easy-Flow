import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from './api';
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
        const resp = await api.get('/api/user/preferences');
        const pref = resp?.data?.ui_preferences?.language;
        if (pref && available.includes(pref)) {
          setLanguageState(pref);
          localStorage.setItem('app_language', pref);
        }
      } catch {}
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
      // Fetch existing preferences to avoid overwriting other fields.
      const current = await api.get('/api/user/preferences');
      const existing = current?.data || {};
      const payload = {
        notification_preferences: existing.notification_preferences || undefined,
        ui_preferences: { ...(existing.ui_preferences || {}), language: lang },
        phone_number: existing.phone_number ?? undefined,
        fcm_token: existing.fcm_token ?? undefined
      };
      await api.put('/api/user/preferences', payload);
    } catch (e) {
      // Fallback: try minimal patch (backend may ignore extras if unsupported)
      try { await api.put('/api/user/preferences', { ui_preferences: { language: lang } }); } catch {}
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