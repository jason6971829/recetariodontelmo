"use client";
// Banner de novedades — lo que ve el equipo al abrir / iniciar sesión (rediseño Don Telmo).
// Slides tipo "historias": imagen (o logo sobre color de la etiqueta) + etiqueta, título, mensaje y botón opcional.
import { useEffect, useRef, useState, useCallback } from "react";
import { useViewport } from "@/hooks/useViewport";

export const BANNER_TAGS = [
  { id: "promo",  name: "Promoción",    c: "#B85E10", bg: "#FFF0E3", g: "linear-gradient(135deg,#E8832B,#7A3606)" },
  { id: "receta", name: "Receta nueva", c: "#1B7A47", bg: "#E8F8EE", g: "linear-gradient(135deg,#2FB67F,#0B3F2B)" },
  { id: "manual", name: "Manual",       c: "#1A6B9E", bg: "#E3F2FD", g: "linear-gradient(135deg,#2F8BC4,#0B2F50)" },
  { id: "aviso",  name: "Aviso",        c: "#8e44ad", bg: "#F5E9FF", g: "linear-gradient(135deg,#A45ACB,#35154A)" },
];
export const bannerTag = (id) => BANNER_TAGS.find(t => t.id === id) || BANNER_TAGS[3];
export const MAX_SLIDES = 5;

// Acepta la config guardada (formato nuevo con slides, o el anterior con solo imágenes)
export function normalizeBanner(cfg) {
  const raw = Array.isArray(cfg?.slides) ? cfg.slides
    : Array.isArray(cfg?.images) ? cfg.images.map(img => ({ tag: "aviso", title: "", text: "", cta: "", img }))
    : [];
  const slides = raw.filter(Boolean).slice(0, MAX_SLIDES).map(s => ({
    tag: bannerTag(s.tag).id, title: String(s.title || ""), text: String(s.text || ""), cta: String(s.cta || ""), img: s.img || null,
  }));
  return { active: !!cfg?.active, slides };
}

const DEFAULT_LOGO = "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png";
const SLIDE_MS = 7000, TICK = 50;
const EASE = "cubic-bezier(.2,.8,.2,1)";

export function BannerCarousel({ slides, onClose, onCta, logo }) {
  const { mobile } = useViewport();
  const [vi, setVi] = useState(0);
  const [prog, setProg] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(1);
  const n = slides.length;
  const st = useRef({ vi: 0, n });
  st.current = { vi, n };

  const go = useCallback((d) => {
    const { vi: i, n: len } = st.current;
    const next = i + d;
    if (next < 0 || next >= len) return;
    setDir(d); setVi(next); setProg(0); setPaused(false);
  }, []);

  // Progreso: el segmento actual se llena en 7 s; al terminar el último queda lleno y en pausa
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setProg(p => {
        const np = p + (TICK / SLIDE_MS) * 100;
        if (np < 100) return np;
        const { vi: i, n: len } = st.current;
        if (i < len - 1) { setDir(1); setVi(i + 1); return 0; }
        setPaused(true);
        return 100;
      });
    }, TICK);
    return () => clearInterval(t);
  }, [paused, vi]);

  useEffect(() => {
    const k = (e) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go, onClose]);

  if (!n) return null;
  const cur = slides[Math.min(vi, n - 1)];
  const tag = bannerTag(cur.tag);
  const last = vi === n - 1;
  const done = last && prog >= 100;
  const slideAnim = `${dir > 0 ? (vi % 2 ? "bnInA" : "bnInB") : (vi % 2 ? "bnInB" : "bnInA")} .6s ${EASE} both`;
  const txtAnim = `${vi % 2 ? "bnTxt" : "bnTxt2"} .55s .1s ${EASE} both`;
  const round = { borderRadius: "50%", border: 0, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div className="bn-root" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(6,16,34,.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 0 : 24, animation: "dtFade .3s both", fontFamily: "Manrope, system-ui, sans-serif" }}>
      <style>{`
        @keyframes bnInA{from{opacity:0;transform:translateX(34px) scale(1.03)}to{opacity:1;transform:none}}
        @keyframes bnInB{from{opacity:0;transform:translateX(-34px) scale(1.03)}to{opacity:1;transform:none}}
        @keyframes bnZoom{from{transform:scale(1)}to{transform:scale(1.09)}}
        @keyframes bnTxt{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes bnTxt2{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes bnPulse{0%,100%{box-shadow:0 0 0 0 rgba(217,115,26,.5)}50%{box-shadow:0 0 0 8px rgba(217,115,26,0)}}
        .bn-x:hover{background:rgba(217,115,26,.9)!important}
        .bn-arrow:hover{background:rgba(255,255,255,.35)!important}
        .bn-cta:hover{background:#D9731A!important;color:#fff!important}
        .bn-pause:hover{border-color:#0E2240!important}
        .bn-done:hover{background:#D9731A!important}
        @media (prefers-reduced-motion: reduce){.bn-root *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
      `}</style>
      <div role="dialog" aria-modal="true" aria-label="Novedades"
        style={{ position: "relative", width: "100%", maxWidth: mobile ? "none" : 1040, height: mobile ? "var(--app-height, 100dvh)" : "min(calc(var(--app-height, 100vh) * .8), 620px)", background: "#fff", borderRadius: mobile ? 0 : 26, overflow: "hidden", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.4fr 1fr", gridTemplateRows: mobile ? "minmax(0,1fr) auto" : "1fr", boxShadow: "0 50px 100px -30px rgba(0,0,0,.7)", animation: `dtPop .5s ${EASE} both` }}>

        {/* Imagen */}
        <div style={{ position: "relative", overflow: "hidden", background: "#0E2240", minHeight: 0 }}>
          <div key={`s-${vi}`} style={{ position: "absolute", inset: 0, animation: slideAnim }}>
            <div style={{ position: "absolute", inset: 0, animation: "bnZoom 9s ease-out both", background: tag.g }}>
              {cur.img ? (cur.title || cur.text) ? (
                <img src={cur.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                // Slide solo con imagen (afiches del banner anterior): se muestra completa, sin recortar
                <>
                  <img src={cur.img} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(22px) brightness(.45)", transform: "scale(1.1)" }} />
                  <img src={cur.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                </>
              ) : (
                <>
                  <img src={logo || DEFAULT_LOGO} alt="" style={{ position: "absolute", left: "50%", top: "50%", width: "58%", maxWidth: 340, transform: "translate(-50%,-50%)", opacity: .2, mixBlendMode: "screen", filter: "grayscale(1) brightness(2)", borderRadius: "50%" }} />
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 80% at 80% 10%,rgba(255,255,255,.16),transparent 60%)" }} />
                </>
              )}
            </div>
          </div>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(6,16,34,.5),transparent 28%,transparent 72%,rgba(6,16,34,.25))", pointerEvents: "none" }} />

          {/* Segmentos de progreso */}
          <div style={{ position: "absolute", top: mobile ? "calc(14px + env(safe-area-inset-top, 0px))" : 16, left: 14, right: 14, display: "flex", gap: 5, zIndex: 4 }}>
            {slides.map((_, i) => (
              <button key={i} onClick={() => { setDir(i > vi ? 1 : -1); setVi(i); setProg(0); setPaused(false); }} aria-label={`Ir al slide ${i + 1}`}
                style={{ flex: 1, height: 18, padding: 0, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <span style={{ width: "100%", height: 4, borderRadius: 3, background: "rgba(255,255,255,.3)", overflow: "hidden", display: "block" }}>
                  <span style={{ display: "block", height: "100%", width: `${i < vi ? 100 : i === vi ? prog : 0}%`, background: "#fff", borderRadius: 3 }} />
                </span>
              </button>
            ))}
          </div>

          <button onClick={onClose} aria-label="Cerrar banner" className="bn-x"
            style={{ ...round, position: "absolute", top: mobile ? "calc(26px + env(safe-area-inset-top, 0px))" : 30, right: 12, zIndex: 5, width: 44, height: 44, background: "rgba(6,16,34,.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", transition: "background .2s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>

          {mobile ? (
            <>
              <div onClick={() => go(-1)} style={{ position: "absolute", left: 0, top: 80, bottom: 0, width: "34%", zIndex: 3 }} />
              <div onClick={() => go(1)} style={{ position: "absolute", right: 0, top: 80, bottom: 0, width: "66%", zIndex: 3 }} />
            </>
          ) : n > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Anterior" className="bn-arrow" style={{ ...round, position: "absolute", left: 14, top: "50%", marginTop: -23, zIndex: 5, width: 46, height: 46, background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", opacity: vi === 0 ? .35 : 1, transition: "all .2s" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <button onClick={() => go(1)} aria-label="Siguiente" className="bn-arrow" style={{ ...round, position: "absolute", right: 14, top: "50%", marginTop: -23, zIndex: 5, width: 46, height: 46, background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", opacity: last ? .35 : 1, transition: "all .2s" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </>
          )}
          <span style={{ position: "absolute", left: 14, bottom: 14, zIndex: 4, height: 28, padding: "0 11px", borderRadius: 999, background: "rgba(6,16,34,.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>{vi + 1} / {n}</span>
        </div>

        {/* Texto */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: mobile ? 12 : 16, padding: mobile ? "20px 20px calc(16px + env(safe-area-inset-bottom, 0px))" : "34px 34px 28px", minHeight: 0, overflowY: "auto", background: "#fff" }}>
          <div key={`t-${vi}`} style={{ display: "flex", flexDirection: "column", gap: mobile ? 12 : 16, animation: txtAnim }}>
            <span style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 7, height: 30, padding: "0 13px", borderRadius: 999, background: tag.bg, color: tag.c, fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: tag.c, animation: "bnPulse 1.8s infinite" }} />{tag.name}
            </span>
            {cur.title && <span style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: mobile ? 27 : 36, fontWeight: 600, color: "#0E2240", lineHeight: 1.08, textWrap: "balance" }}>{cur.title}</span>}
            {cur.text && <span style={{ fontSize: mobile ? 15 : 16.5, lineHeight: 1.5, color: "#3C3A36", textWrap: "pretty", whiteSpace: "pre-line" }}>{cur.text}</span>}
            {cur.cta && (
              <button onClick={() => (onCta ? onCta(cur) : onClose())} className="bn-cta" style={{ alignSelf: "flex-start", height: 46, padding: "0 18px", borderRadius: 13, border: "1.5px solid #D9731A", background: "#fff", color: "#B85E10", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all .2s", fontFamily: "inherit" }}>
                {cur.cta}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setPaused(p => (done ? p : !p))} aria-label={paused ? "Reanudar" : "Pausar"} className="bn-pause" style={{ width: 52, height: 52, borderRadius: 14, border: "1.5px solid #E7E1D7", background: "#fff", color: "#0E2240", cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color .2s" }}>
              {paused
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>}
            </button>
            <button onClick={onClose} className="bn-done" style={{ flex: 1, height: 52, borderRadius: 14, border: 0, background: last ? "#1F9D6B" : "#0E2240", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .3s", animation: done ? "bnPulse 1.8s infinite" : "none", fontFamily: "inherit" }}>
              {last ? "Entendido" : "Saltar al recetario"}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={last ? "M5 12l5 5L20 7" : "M5 12h14M13 6l6 6-6 6"} /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
