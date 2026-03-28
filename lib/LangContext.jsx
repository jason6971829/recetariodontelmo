"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { getT, LANGUAGES } from "@/lib/i18n";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState("es");

  useEffect(() => {
    const saved = localStorage.getItem("dontelmo:lang");
    if (saved && LANGUAGES.find(l => l.code === saved)) setLangState(saved);
  }, []);

  const setLang = (code) => {
    setLangState(code);
    localStorage.setItem("dontelmo:lang", code);
  };

  const t = getT(lang);

  return (
    <LangContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
