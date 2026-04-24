"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, translations, TranslationKey, tpl } from "@/lib/i18n";

const LANG_STORAGE_KEY = "sakura_lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  // Default context value matches SSR initial render; see Provider below for
  // why "ja" is the canonical default.
  lang: "ja",
  setLang: () => {},
  t: (key) => translations[key]["ja"],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Sakura's brand positioning is Japanese-primary (see app/layout.tsx —
  // <html lang="ja">, locale: "ja_JP", JA title + description). EN and ZH
  // are courtesy translations for users in those regions. Server-side
  // render + first client paint both use "ja" so the initial HTML
  // matches the declared html lang attribute — no hydration mismatch.
  //
  // On mount (client only, after hydration completes), we pick the best
  // lang for this specific user by priority:
  //   1. localStorage `sakura_lang` — explicit past user choice, highest
  //   2. navigator.language — browser region hint, zero-friction default
  //      - zh-* (zh, zh-CN, zh-TW, zh-HK, …) → zh
  //      - ja-* → ja (same as SSR default; no-op)
  //      - anything else → en
  //
  // This gives Japanese visitors the JA-primary experience on every
  // surface (SEO, OG card, SSR, runtime) while still letting the
  // secondary-market user arrive at "their" language on first visit.
  const [lang, setLangState] = useState<Lang>("ja");

  useEffect(() => {
    // Priority 1: explicit saved choice
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "zh" || saved === "en" || saved === "ja") {
      setLangState(saved);
      return;
    }
    // Priority 2: browser region hint
    const nav = (typeof navigator !== "undefined" && navigator.language) || "";
    const low = nav.toLowerCase();
    if (low.startsWith("zh")) setLangState("zh");
    else if (low.startsWith("ja")) setLangState("ja"); // no-op, already default
    else setLangState("en");
  }, []);

  function setLang(l: Lang) {
    localStorage.setItem(LANG_STORAGE_KEY, l);
    setLangState(l);
  }

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    // Fallback chain: active lang → ja (primary brand) → key itself.
    // If a translation is missing for the active lang, show the canonical
    // Japanese version rather than an arbitrary secondary — keeps the
    // brand-primary promise even on incomplete i18n coverage.
    const str = translations[key][lang] ?? translations[key]["ja"] ?? key;
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
