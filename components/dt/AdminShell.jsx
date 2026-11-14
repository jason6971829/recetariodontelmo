"use client";
// Contenedor común de las pantallas de administración (rediseño Don Telmo):
// hoja desde abajo en celular, modal centrado en tablet/computador, encabezado navy, pie blanco y toast.
import { useEffect, useState, useCallback } from "react";
import { useViewport } from "@/hooks/useViewport";

export const A = {
  navy: "#0E2240", navy2: "#16325A", orange: "#D9731A", orange7: "#B85E10", orangeSoft: "#F0A35E", orange1: "#FFF0E3", orange2: "#FBEBDD",
  cream: "#F6F3EE", line: "#E7E1D7", ink: "#14213D", ink2: "#3C3A36", muted: "#6E6A63", muted2: "#8A847A", muted3: "#A39D92",
  green: "#1F9D6B", red: "#C8423B", grayBtn: "#EFEAE2", blueSoft: "#8FAACB",
  ease: "cubic-bezier(.2,.8,.2,1)", serif: "Newsreader, Georgia, serif", sans: "Manrope, system-ui, sans-serif",
};

// Estilos reutilizables
export const card = { background: "#fff", borderRadius: 18, boxShadow: "0 0 0 1px rgba(14,34,64,.06)" };
export const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: ".18em", color: A.orange };
export const fieldLabel = { fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: A.muted2 };
// 16px evita el zoom automático de iOS al enfocar
export const input = { width: "100%", height: 48, padding: "0 14px", borderRadius: 12, border: `1.5px solid ${A.line}`, background: "#fff", fontSize: 16, fontWeight: 600, color: A.ink, fontFamily: "inherit", boxSizing: "border-box" };

export function AdminShell({ icon, eyebrow: eb = "ADMINISTRACIÓN", title, maxWidth = 760, onClose, headerExtra, footer, children, bodyGap = 16, zIndex = 9990 }) {
  const { mobile } = useViewport();
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex, background: "rgba(9,24,49,.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 20, animation: "dtFade .25s both", fontFamily: A.sans, color: A.ink }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ position: "relative", width: "100%", maxWidth: mobile ? "none" : maxWidth, maxHeight: mobile ? "calc(var(--app-height, 100vh) * .94)" : "min(calc(var(--app-height, 100vh) * .92), 920px)", background: A.cream, borderRadius: mobile ? "24px 24px 0 0" : 24, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)", animation: mobile ? `dtSheet .42s ${A.ease} both` : `dtPop .35s ${A.ease} both` }}>
        <div style={{ flex: "none", background: `linear-gradient(160deg,${A.navy2},${A.navy})`, color: "#fff", padding: mobile ? "16px 16px 16px" : "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(217,115,26,.18)", color: A.orangeSoft, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{icon}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: A.orangeSoft }}>{eb}</span>
              <span style={{ fontFamily: A.serif, fontSize: mobile ? 21 : 25, fontWeight: 600, lineHeight: 1.05 }}>{title}</span>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="dt-adm-x" style={{ width: 42, height: 42, borderRadius: 12, border: 0, background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          {headerExtra}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: mobile ? 14 : 20, display: "flex", flexDirection: "column", gap: bodyGap, WebkitOverflowScrolling: "touch" }}>
          {children}
          {!footer && <div style={{ flex: "none", height: "env(safe-area-inset-bottom, 0px)" }} />}
        </div>
        {footer && (
          <div style={{ flex: "none", background: "#fff", borderTop: `1px solid ${A.line}`, padding: mobile ? "12px 14px calc(12px + env(safe-area-inset-bottom, 0px))" : "14px 20px", display: "flex", gap: 10 }}>
            {footer}
          </div>
        )}
        <style>{`
          .dt-adm-x:hover{background:rgba(255,255,255,.2)!important}
          .dt-adm-navy:hover:not(:disabled){background:${A.orange}!important}
          .dt-adm-gray:hover:not(:disabled){background:#E5DED3!important}
          .dt-adm-orange:hover:not(:disabled){background:${A.orange7}!important}
          .dt-adm input:focus,.dt-adm select:focus,.dt-adm textarea:focus{outline:none;border-color:${A.orange}!important;box-shadow:0 0 0 4px rgba(217,115,26,.14)}
          @keyframes dtToast{0%{opacity:0;transform:translate(-50%,16px)}12%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,8px)}}
          @media (prefers-reduced-motion: reduce){.dt-adm *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
        `}</style>
      </div>
    </div>
  );
}

// Botones del pie: gris (secundario) y navy (principal, hover naranja). Alto 50.
export function FootBtn({ kind = "navy", children, style, ...p }) {
  const base = { flex: kind === "navy" ? 2 : 1, height: 50, borderRadius: 14, border: 0, fontSize: 15, fontWeight: 800, cursor: p.disabled ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background .2s", opacity: p.disabled ? .6 : 1 };
  const kinds = { navy: { background: A.navy, color: "#fff" }, gray: { background: A.grayBtn, color: A.ink2 }, orange: { background: A.orange, color: "#fff" } };
  return <button className={`dt-adm-${kind}`} {...p} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>;
}

// Interruptor 52×30, verde al activar
export function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 52, height: 30, borderRadius: 999, border: 0, padding: 0, background: on ? A.green : "#D8D2C8", position: "relative", cursor: "pointer", flex: "none", transition: "background .3s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 5px rgba(0,0,0,.25)", transition: `left .3s ${A.ease}` }} />
    </button>
  );
}

// Toast navy (2.4 s). Uso: const [toast, showToast] = useToast(); ... {toast}
export function useToast() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((text) => setMsg({ text, k: Date.now() }), []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2400); return () => clearTimeout(t); }, [msg]);
  const node = msg ? (
    <div key={msg.k} role="status" style={{ position: "fixed", left: "50%", bottom: "calc(28px + env(safe-area-inset-bottom, 0px))", zIndex: 10050, background: A.navy, color: "#fff", padding: "12px 20px", borderRadius: 999, fontSize: 14, fontWeight: 700, fontFamily: A.sans, boxShadow: "0 16px 40px -12px rgba(0,0,0,.5)", animation: "dtToast 2.4s both", pointerEvents: "none", whiteSpace: "nowrap", maxWidth: "90vw", overflow: "hidden", textOverflow: "ellipsis" }}>{msg.text}</div>
  ) : null;
  return [node, show];
}

// Conteo animado (900 ms ease-out) para las métricas
export function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const to = Number(target) || 0;
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf, t0;
    const step = (t) => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    // Respaldo: si la pestaña está oculta requestAnimationFrame no corre
    const safety = setTimeout(() => setV(to), ms + 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [target, ms]);
  return v;
}
