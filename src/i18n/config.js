import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translations.json'
import es from './locales/es/translations.json'
import zh from './locales/zh/translations.json'

i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: 'en',
  resources: {
    en: {
      translations: en
    },
    es: {
      translations: es
    },
    zh: {
      translations: zh
    }
  },
  ns: ['translations'],
  defaultNS: 'translations',
  interpolation: { escapeValue: false }
});

i18n.languages = ['en', 'es', 'zh'];

export default i18n;
