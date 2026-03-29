"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { getT, LANGUAGES } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState("es");
  const [themeId, setThemeIdState] = useState("ocean");

  useEffect(() => {
    // 1) Carga inmediata desde localStorage — evita flash de color
    const saved = localStorage.getItem("dontelmo:lang");
    if (saved && LANGUAGES.find(l => l.code === saved)) setLangState(saved);
    const savedTheme = localStorage.getItem("dontelmo:theme");
    if (savedTheme && THEMES.find(t => t.id === savedTheme)) setThemeIdState(savedTheme);

    // 2) Carga asíncrona desde Supabase — sincroniza entre dispositivos
    //    Se hace aquí, en el contexto, para acceder directamente a setThemeIdState
    //    y evitar problemas de closure en App.jsx.
    async function syncThemeFromCloud() {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: urlData } = supabase.storage
          .from("recipe-images")
          .getPublicUrl("app/config.json");
        const res = await fetch(urlData.publicUrl + "?t=" + Date.now());
        if (!res.ok) return;
        const cfg = await res.json();
        if (cfg?.themeId && THEMES.find(t => t.id === cfg.themeId)) {
          setThemeIdState(cfg.themeId);
          localStorage.setItem("dontelmo:theme", cfg.themeId);
        }
      } catch {}
    }
    syncThemeFromCloud();
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
