"use client";
import { useState, useEffect, useRef } from "react";
import { sha256 } from "@/lib/security";

// Confirmación de acciones peligrosas (rediseño Don Telmo).
// confirmModal: { title, message, details?: string[], requireKey?: bool, confirmLabel?, onConfirm: async () => {} }
// Con requireKey: dos filtros → 1) aviso "¿estás seguro?"  2) clave de seguridad (la misma del Perfil).
// 3 claves equivocadas bloquean eliminar por 2 minutos (queda guardado aunque se recargue la página).
const LOCK_KEY = "dontelmo:deleteLock";
const LOCK_MS = 2 * 60 * 1000;
const lockLeft = () => { try { return Math.max(0, (parseInt(localStorage.getItem(LOCK_KEY) || "0", 10) || 0) - Date.now()); } catch { return 0; } };

export function ConfirmModal({ confirmModal, onCancel, profileHash }) {
  const [step, setStep] = useState("confirm");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);
  const [locked, setLocked] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { setStep("confirm"); setKey(""); setErr(""); setBusy(false); setTries(0); setLocked(lockLeft()); }, [confirmModal]);
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setLocked(lockLeft()), 1000);
    return () => clearInterval(t);
  }, [locked]);
  useEffect(() => { if (step === "key") setTimeout(() => inputRef.current?.focus(), 50); }, [step]);

  if (!confirmModal) return null;
  const { title, message, details, requireKey, confirmLabel } = confirmModal;

  const run = async () => {
    setBusy(true);
    try { await confirmModal.onConfirm(); } catch (e) { setErr("No se pudo eliminar. Revisa la conexión e intenta de nuevo."); setBusy(false); }
  };
  const next = () => (requireKey ? setStep("key") : run());
  const verify = async () => {
    if (lockLeft() > 0 || busy || !key.trim()) return;
    const ok = (await sha256(key.trim())) === profileHash;
    if (ok) { setErr(""); run(); return; }
    const n = tries + 1;
    setTries(n); setKey("");
    if (n >= 3) {
      try { localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS)); } catch { /* */ }
      setLocked(LOCK_MS); setErr("");
    } else {
      setErr(`Clave incorrecta. Te queda${3 - n === 1 ? "" : "n"} ${3 - n} intento${3 - n === 1 ? "" : "s"}.`);
    }
  };

  const secs = Math.ceil(locked / 1000);
  const btn = { width: "100%", height: 50, borderRadius: 14, border: 0, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "var(--dt-sans)" };

  return (
    <div className="dt-scope" onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(9,24,49,.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", animation: "dtFade .25s both", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--dt-sans)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 24, padding: "28px 24px 22px", width: "100%", maxWidth: 420, boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)", animation: "dtPop .3s cubic-bezier(.2,.8,.2,1) both", color: "#14213D" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: step === "key" ? "#0E2240" : "#FDECEA", color: step === "key" ? "#fff" : "#C8423B", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {step === "key"
              ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>}
          </span>
          {requireKey && <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".2em", color: "#A39D92" }}>PASO {step === "key" ? 2 : 1} DE 2</span>}
          <span style={{ fontFamily: "var(--dt-serif)", fontSize: 24, fontWeight: 600, color: "#0E2240", lineHeight: 1.15 }}>{step === "key" ? "Clave de seguridad" : title}</span>
          <span style={{ fontSize: 14, color: "#6E6A63", lineHeight: 1.55 }}>
            {step === "key" ? "Para eliminar escribe la clave de seguridad del administrador (la misma de Perfil)." : message}
          </span>
        </div>

        {step === "confirm" && details && details.length > 0 && (
          <div style={{ marginTop: 14, background: "#FDF3F2", border: "1px solid #F3C9C4", borderRadius: 14, padding: "10px 14px", maxHeight: 160, overflowY: "auto", fontSize: 13, color: "#8e2b20", lineHeight: 1.6 }}>
            {details.map((d, i) => <div key={i}>• {d}</div>)}
          </div>
        )}

        {step === "key" && (
          <div style={{ marginTop: 16 }}>
            {locked > 0 ? (
              <div style={{ textAlign: "center", background: "#FDECEA", borderRadius: 14, padding: 14, color: "#C8423B", fontWeight: 800, fontSize: 14 }}>
                Demasiados intentos. Eliminar está bloqueado por {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
              </div>
            ) : (
              <input ref={inputRef} type="password" value={key} onChange={e => { setKey(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && verify()}
                placeholder="Clave de seguridad" autoComplete="off"
                style={{ width: "100%", height: 52, padding: "0 16px", border: "1.5px solid #E7E1D7", borderRadius: 14, background: "#FAF8F4", fontSize: 16, fontWeight: 700, color: "#0E2240", outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: ".1em" }} />
            )}
          </div>
        )}

        {err && <div style={{ marginTop: 12, textAlign: "center", color: "#C8423B", fontSize: 13, fontWeight: 700 }}>{err}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
          {step === "confirm" ? (
            <button onClick={next} disabled={busy} style={{ ...btn, background: "#C8423B", color: "#fff", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Eliminando…" : requireKey ? "Sí, continuar" : (confirmLabel || "Sí, eliminar")}
            </button>
          ) : (
            <button onClick={verify} disabled={busy || locked > 0 || !key.trim()} style={{ ...btn, background: "#C8423B", color: "#fff", opacity: busy || locked > 0 || !key.trim() ? 0.5 : 1, cursor: busy || locked > 0 || !key.trim() ? "not-allowed" : "pointer" }}>
              {busy ? "Eliminando…" : (confirmLabel || "Eliminar definitivamente")}
            </button>
          )}
          <button onClick={onCancel} disabled={busy} style={{ ...btn, height: 46, background: "#F3EFE8", color: "#4A463F", fontWeight: 700 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
