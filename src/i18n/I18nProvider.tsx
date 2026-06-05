import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  isAppLanguage,
  normalizeLanguage,
  translations,
  type AppLanguage,
  type LanguageOption,
  type Translation,
} from "./translations";

type I18nContextValue = {
  language: AppLanguage;
  languageOption: LanguageOption;
  languages: LanguageOption[];
  t: Translation;
  setLanguage: (language: AppLanguage) => void;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(detectInitialLanguage);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    const option = LANGUAGE_OPTIONS.find((item) => item.code === language);
    document.documentElement.lang = option?.htmlLang ?? language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const languageOption =
      LANGUAGE_OPTIONS.find((item) => item.code === language) ??
      LANGUAGE_OPTIONS[0];

    return {
      language,
      languageOption,
      languages: LANGUAGE_OPTIONS,
      t: translations[language],
      setLanguage,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

function detectInitialLanguage(): AppLanguage {
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage && isAppLanguage(storedLanguage)) {
    return storedLanguage;
  }

  for (const language of window.navigator.languages ?? []) {
    const appLanguage = normalizeLanguage(language);
    if (appLanguage) {
      return appLanguage;
    }
  }

  return normalizeLanguage(window.navigator.language) ?? DEFAULT_LANGUAGE;
}
