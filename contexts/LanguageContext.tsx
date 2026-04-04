"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Lang, translations, TranslationKey, tpl } from "@/lib/i18n";

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
  const [lang, setLang] = useState<Lang>("en");

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
