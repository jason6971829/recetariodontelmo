"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { getT, LANGUAGES } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState("es");
  const [themeId, setThemeIdState] = useState("ocean");

  useEffect(() => {
    const saved = localStorage.getItem("dontelmo:lang");
    if (saved && LANGUAGES.find(l => l.code === saved)) setLangState(saved);
    const savedTheme = localStorage.getItem("dontelmo:theme");
    if (savedTheme && THEMES.find(t => t.id === savedTheme)) setThemeIdState(savedTheme);
  }, []);

  const setLang = (code) => {
    setLangState(code);
    localStorage.setItem("dontelmo:lang", code);
  };

  const setTheme = (id) => {
    setThemeIdState(id);
    localStorage.setItem("dontelmo:theme", id);
  };

  const t = getT(lang);

  return (
    <LangContext.Provider value={{ lang, setLang, t, LANGUAGES, themeId, setTheme, themes: THEMES }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
