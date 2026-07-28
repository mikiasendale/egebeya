import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import am from './locales/am.json';

const stored = typeof window !== 'undefined' ? localStorage.getItem('i18nextLng') : null;
const initialLng = stored || 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, am: { translation: am } },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  detection: { order: [] },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nextLng', lng);
  document.documentElement.lang = lng;
});

export default i18n;
