// Lightweight i18n loader with dynamic JSON imports and fallback.
import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../utils/LanguageContext';

const cache = {};

async function loadLocale(lang) {
 if (cache[lang]) return cache[lang];
 try {
 const mod = await import(/* webpackChunkName: "locale-[request]" */ `./locales/${lang}.json`);
 cache[lang] = mod.default || mod;
 return cache[lang];
 } catch (e) {
 if (lang !== 'en') {
 return loadLocale('en');
 }
 return {};
 }
}

export function useI18n() {
 const { language } = useLanguage();
 const [messages, setMessages] = useState({});
 const activeLang = useRef(language);

 useEffect(() => {
 let cancelled = false;
 activeLang.current = language;
 loadLocale(language).then((msgs) => {
 if (!cancelled && activeLang.current === language) setMessages(msgs || {});
 });
 return () => { cancelled = true; };
 }, [language]);

 function t(key, fallback) {
 if (messages && Object.prototype.hasOwnProperty.call(messages, key)) {
 return messages[key];
 }
 // attempt English fallback if current isn't English
 if (language !== 'en' && cache.en && Object.prototype.hasOwnProperty.call(cache.en, key)) {
 return cache.en[key];
 }
 return fallback || key;
 }

 return { t, language };
}

// Helper to bulk register defaults (for extraction or debugging)
export function dumpLoadedKeys() { return Object.keys(cache.en || {}); }
