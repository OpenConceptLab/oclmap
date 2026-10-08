import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translations.json'
import es from './locales/es/translations.json'
import zh from './locales/zh/translations.json'
import ptBR from './locales/pt-BR/translations.json'

const LANGUAGE_STORAGE_KEY = 'ocl.language'
const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'pt-BR']

const getInitialLanguage = () => {
  if(typeof window === 'undefined')
    return 'en'

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(storedLanguage) ? storedLanguage : 'en'
  } catch(_) {
    return 'en'
  }
}

const persistLanguage = language => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch(_) {
    // Keep i18n usable when browser storage is unavailable.
  }
}

i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: getInitialLanguage(),
  resources: {
    en: {
      translations: en
    },
    es: {
      translations: es
    },
    zh: {
      translations: zh
    },
    'pt-BR': {
      translations: ptBR
    }
  },
  ns: ['translations'],
  defaultNS: 'translations',
  interpolation: { escapeValue: false }
});

i18n.languages = SUPPORTED_LANGUAGES;
i18n.on('languageChanged', persistLanguage)

export default i18n;
