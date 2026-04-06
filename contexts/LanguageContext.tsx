"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, translations, TranslationKey, tpl } from "@/lib/i18n";

const LANG_STORAGE_KEY = "solis_lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations[key]["en"],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Restore saved language on first mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "zh" || saved === "ja") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    localStorage.setItem(LANG_STORAGE_KEY, l);
    setLangState(l);
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    const str = translations[key][lang] ?? translations[key]["zh"] ?? key;
    return vars ? tpl(str, vars) : str;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
