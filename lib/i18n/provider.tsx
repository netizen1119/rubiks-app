"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect } from "react";
import { useAppStore, type Language } from "@/lib/store/store";
import koMessages from "@/messages/ko.json";
import enMessages from "@/messages/en.json";

const STORAGE_KEY = "rubiks-language.v1";

const detectBrowserLang = (): Language => {
  if (typeof navigator === "undefined") return "ko";
  const lang = navigator.language || (navigator as any).userLanguage || "";
  return lang.toLowerCase().startsWith("ko") ? "ko" : "en";
};

const messagesByLang = { ko: koMessages, en: enMessages } as const;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useAppStore((s) => s.language);
  const updateStore = useAppStore((s) => s.updateStore);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "ko" || saved === "en") {
        updateStore({ language: saved });
        document.documentElement.lang = saved;
      } else {
        const detected = detectBrowserLang();
        updateStore({ language: detected });
        document.documentElement.lang = detected;
      }
    } catch {
      const detected = detectBrowserLang();
      updateStore({ language: detected });
    }
  }, [updateStore]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  return (
    <NextIntlClientProvider
      locale={language}
      messages={messagesByLang[language]}
      timeZone="Asia/Seoul"
    >
      {children}
    </NextIntlClientProvider>
  );
}
